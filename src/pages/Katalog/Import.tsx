import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Cloud, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

type Row = Record<string, any>;

// Katalog-Zielfelder (bewusst ohne Einkaufspreis-Felder – siehe Katalog-Plan)
const TARGET_FIELDS = [
  { key: 'sku', label: 'SKU *', required: true },
  { key: 'name', label: 'Name *', required: true },
  { key: 'brand', label: 'Marke' },
  { key: 'model', label: 'Modell' },
  { key: 'notes_internal', label: 'Interne Notiz' },
  { key: 'status', label: 'Status (entwurf/aktiv/…)' },
  { key: 'uvp_net', label: 'UVP netto (optional Preiszeile)' },
  { key: 'uvp_gross', label: 'UVP brutto (optional Preiszeile)' },
  { key: 'country_code', label: 'Länder-ISO (für Preis, z. B. DE)' },
] as const;

// Erkennt UVB als UVP (laut Prompt)
const AUTO_ALIASES: Record<string, string> = {
  sku: 'sku', artikelnr: 'sku', artikelnummer: 'sku', 'article number': 'sku',
  name: 'name', bezeichnung: 'name', title: 'name', titel: 'name',
  produktname: 'name', 'produkt name': 'name', productname: 'name', 'product name': 'name',
  brand: 'brand', marke: 'brand', hersteller: 'brand',
  model: 'model', modell: 'model',
  notes: 'notes_internal', notiz: 'notes_internal', 'interne notiz': 'notes_internal',
  kurzbeschreibung: 'notes_internal', beschreibung: 'notes_internal',
  status: 'status',
  uvp: 'uvp_net', uvb: 'uvp_net', 'uvp netto': 'uvp_net', rrp: 'uvp_net',
  'uvp preis': 'uvp_gross', 'uvp brutto': 'uvp_gross',
  country: 'country_code', land: 'country_code', 'country code': 'country_code', iso: 'country_code',
};

function autoMap(headers: string[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const h of headers) {
    const k = h.trim().toLowerCase();
    if (AUTO_ALIASES[k]) m[h] = AUTO_ALIASES[k];
  }
  return m;
}

function parseNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

export default function KatalogImport() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ inserted: number; updated: number; skipped: number; errors: string[] } | null>(null);

  // Airtable-State (via Connector Gateway – kein Token im Browser)
  const [atBases, setAtBases] = useState<{ id: string; name: string }[]>([]);
  const [atTables, setAtTables] = useState<{ id: string; name: string }[]>([]);
  const [atBase, setAtBase] = useState('');
  const [atTable, setAtTable] = useState('');
  const [atLoading, setAtLoading] = useState(false);

  const onFile = async (f: File) => {
    setFileName(f.name);
    setResult(null);
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' });
    const hdrs = data.length ? Object.keys(data[0]) : [];
    setHeaders(hdrs);
    setRows(data);
    setMapping(autoMap(hdrs));
  };

  const callAt = async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke('catalog-import-airtable', {
      body: { action, ...extra },
    });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const loadBases = async () => {
    setAtLoading(true);
    try {
      const d = await callAt('list_bases');
      setAtBases(d.bases ?? []);
      toast({ title: `${(d.bases ?? []).length} Bases geladen` });
    } catch (e: any) {
      toast({ title: 'Airtable-Fehler', description: e.message, variant: 'destructive' });
    } finally { setAtLoading(false); }
  };

  const loadTables = async (baseId: string) => {
    setAtBase(baseId);
    setAtTable('');
    setAtTables([]);
    if (!baseId) return;
    setAtLoading(true);
    try {
      const d = await callAt('list_tables', { baseId });
      setAtTables(d.tables ?? []);
    } catch (e: any) {
      toast({ title: 'Airtable-Fehler', description: e.message, variant: 'destructive' });
    } finally { setAtLoading(false); }
  };

  const loadAirtable = async () => {
    if (!atBase || !atTable) {
      toast({ title: 'Bitte Base und Tabelle wählen', variant: 'destructive' });
      return;
    }
    setAtLoading(true);
    setResult(null);
    try {
      const d = await callAt('preview', { baseId: atBase, tableId: atTable });
      const recs: Row[] = (d.records ?? []).map((r: any) => r.fields ?? {});
      const hdrSet = new Set<string>();
      recs.forEach((r) => Object.keys(r).forEach((k) => hdrSet.add(k)));
      const hdrs = Array.from(hdrSet);
      const tableName = atTables.find((t) => t.id === atTable)?.name ?? atTable;
      setFileName(`Airtable: ${tableName}`);
      setHeaders(hdrs);
      setRows(recs);
      setMapping(autoMap(hdrs));
      toast({ title: `${recs.length} Datensätze geladen (Vorschau)` });
    } catch (e: any) {
      toast({ title: 'Airtable-Fehler', description: e.message, variant: 'destructive' });
    } finally {
      setAtLoading(false);
    }
  };

  const mappedPreview = useMemo(() => rows.slice(0, 10).map((r) => {
    const out: Row = {};
    for (const [src, tgt] of Object.entries(mapping)) {
      if (tgt && tgt !== '__ignore__') out[tgt] = r[src];
    }
    return out;
  }), [rows, mapping]);

  const hasSku = Object.values(mapping).includes('sku');
  const hasName = Object.values(mapping).includes('name');

  const runImport = async () => {
    if (!hasSku || !hasName) {
      toast({ title: 'SKU und Name müssen zugeordnet sein', variant: 'destructive' });
      return;
    }
    setRunning(true);
    const client = supabase as any;
    const stats = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };

    // Länder-Cache (für optionale Preiszeile)
    const { data: countries } = await client.from('catalog_countries').select('id, iso_code, currency_id, default_tax_rate');
    const countryByIso: Record<string, any> = {};
    (countries ?? []).forEach((c: any) => { countryByIso[String(c.iso_code).toUpperCase()] = c; });

    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id ?? null;

    for (const raw of rows) {
      try {
        const mapped: Row = {};
        for (const [src, tgt] of Object.entries(mapping)) {
          if (tgt && tgt !== '__ignore__') mapped[tgt] = raw[src];
        }
        const sku = String(mapped.sku ?? '').trim();
        const name = String(mapped.name ?? '').trim();
        if (!sku || !name) { stats.skipped++; continue; }

        const itemPayload: Row = {
          sku, name,
          brand: mapped.brand ? String(mapped.brand).trim() : null,
          model: mapped.model ? String(mapped.model).trim() : null,
          notes_internal: mapped.notes_internal ? String(mapped.notes_internal).trim() : null,
          status: mapped.status ? String(mapped.status).trim().toLowerCase() : 'entwurf',
        };

        // Prüfen ob existiert
        const { data: existing } = await client.from('catalog_items').select('id').eq('sku', sku).maybeSingle();
        let itemId: string;
        if (existing?.id) {
          const { error } = await client.from('catalog_items').update(itemPayload).eq('id', existing.id);
          if (error) throw error;
          itemId = existing.id;
          stats.updated++;
        } else {
          const { data, error } = await client.from('catalog_items').insert(itemPayload).select('id').single();
          if (error) throw error;
          itemId = data.id;
          stats.inserted++;
        }

        // Optional Preiszeile
        const uvpNet = parseNum(mapped.uvp_net);
        const uvpGross = parseNum(mapped.uvp_gross);
        const iso = mapped.country_code ? String(mapped.country_code).trim().toUpperCase() : '';
        if (iso && (uvpNet !== null || uvpGross !== null)) {
          const c = countryByIso[iso];
          if (c) {
            await client.from('catalog_item_prices').insert({
              item_id: itemId,
              country_id: c.id,
              currency_id: c.currency_id,
              uvp_net: uvpNet,
              uvp_gross: uvpGross,
              tax_rate: c.default_tax_rate,
              price_status: 'entwurf',
            });
          }
        }

        // Änderungslog
        await client.from('catalog_change_log').insert({
          entity_type: 'catalog_items',
          entity_id: itemId,
          action: existing?.id ? 'import_update' : 'import_insert',
          source: fileName || 'import',
          changed_by: userId,
        });
      } catch (e: any) {
        stats.errors.push(`${raw[Object.keys(mapping).find((k) => mapping[k] === 'sku') ?? ''] ?? '?'}: ${e.message}`);
      }
    }

    setRunning(false);
    setResult(stats);
    toast({ title: 'Import abgeschlossen', description: `${stats.inserted} neu · ${stats.updated} aktualisiert · ${stats.skipped} übersprungen` });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex gap-3 items-start">
        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          Import von Katalog-Artikeln aus Excel, CSV oder Airtable. Einkaufspreise werden bewusst nicht importiert. UVP/UVB werden als UVP erkannt. Bestehende SKUs werden aktualisiert.
        </div>
      </Card>

      <Tabs defaultValue="file">
        <TabsList>
          <TabsTrigger value="file"><FileSpreadsheet className="h-4 w-4 mr-2" />Excel / CSV</TabsTrigger>
          <TabsTrigger value="airtable"><Cloud className="h-4 w-4 mr-2" />Airtable</TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="space-y-3">
          <Card className="p-4">
            <div className="flex gap-3 items-center">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
              <Button onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Datei wählen</Button>
              {fileName && <span className="text-sm text-muted-foreground">{fileName} · {rows.length} Zeilen</span>}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="airtable" className="space-y-3">
          <Card className="p-4 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Button onClick={loadBases} disabled={atLoading} variant="outline">
                {atLoading ? 'Lade…' : (atBases.length ? 'Bases neu laden' : 'Bases laden')}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Nutzt den verbundenen Airtable-Connector – kein Token nötig.
              </p>
            </div>
            {atBases.length > 0 && (
              <>
                <div>
                  <Label>Base</Label>
                  <Select value={atBase} onValueChange={loadTables}>
                    <SelectTrigger><SelectValue placeholder="Base wählen" /></SelectTrigger>
                    <SelectContent>
                      {atBases.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tabelle</Label>
                  <Select value={atTable} onValueChange={setAtTable} disabled={!atTables.length}>
                    <SelectTrigger><SelectValue placeholder="Tabelle wählen" /></SelectTrigger>
                    <SelectContent>
                      {atTables.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={loadAirtable} disabled={atLoading || !atBase || !atTable}>
                    {atLoading ? 'Lade…' : 'Aus Airtable laden'}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {headers.length > 0 && (
        <Card className="p-4 space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Spaltenzuordnung</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-1 rounded bg-muted flex-1 truncate" title={h}>{h}</span>
                  <span className="text-muted-foreground">→</span>
                  <Select value={mapping[h] ?? '__ignore__'} onValueChange={(v) => setMapping({ ...mapping, [h]: v })}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ignore__">— Ignorieren —</SelectItem>
                      {TARGET_FIELDS.map((t) => (
                        <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              {!hasSku && <Badge variant="destructive">SKU fehlt</Badge>}
              {!hasName && <Badge variant="destructive">Name fehlt</Badge>}
              {hasSku && hasName && <Badge className="bg-emerald-500/15 text-emerald-500">Bereit für Import</Badge>}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Vorschau (max. 10)</h3>
            <div className="border rounded-md overflow-auto max-h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    {TARGET_FIELDS.filter((t) => Object.values(mapping).includes(t.key)).map((t) => (
                      <TableHead key={t.key}>{t.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedPreview.map((r, i) => (
                    <TableRow key={i}>
                      {TARGET_FIELDS.filter((t) => Object.values(mapping).includes(t.key)).map((t) => (
                        <TableCell key={t.key} className="text-xs">{String(r[t.key] ?? '')}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={runImport} disabled={running || !hasSku || !hasName}>
              {running ? 'Importiere…' : `Import starten (${rows.length} Zeilen)`}
            </Button>
          </div>
        </Card>
      )}

      {result && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold">Ergebnis</h3>
          </div>
          <div className="flex gap-4 text-sm">
            <span>Neu: <b>{result.inserted}</b></span>
            <span>Aktualisiert: <b>{result.updated}</b></span>
            <span>Übersprungen: <b>{result.skipped}</b></span>
            <span>Fehler: <b>{result.errors.length}</b></span>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-2 text-sm text-red-500 mb-1">
                <AlertTriangle className="h-4 w-4" /> Fehlerdetails
              </div>
              <div className="max-h-48 overflow-auto text-xs font-mono bg-muted rounded p-2 space-y-1">
                {result.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
