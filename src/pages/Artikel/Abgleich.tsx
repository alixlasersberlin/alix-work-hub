import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRightLeft, Loader2, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const db = supabase as any;

type Verdict = 'neu' | 'uebernehmen' | 'konflikt' | 'identisch';

const VERDICTS: Record<Verdict, { label: string; tone: string }> = {
  neu: { label: 'NEU', tone: 'bg-sky-500/15 text-sky-500' },
  uebernehmen: { label: 'ÜBERNEHMEN', tone: 'bg-emerald-500/15 text-emerald-600' },
  konflikt: { label: 'KONFLIKT', tone: 'bg-destructive/15 text-destructive' },
  identisch: { label: 'IDENTISCH', tone: 'bg-muted text-muted-foreground' },
};

const norm = (v?: string | null) => (v || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

interface SourceRow {
  key: string;
  origin: 'catalog' | 'plm';
  id: string;
  sku: string | null;
  name: string | null;
  fields: Record<string, any>;
}

interface Diff { field: string; label: string; source: any; master: any; kind: 'fill' | 'conflict' }

const FIELD_LABELS: Record<string, string> = {
  sku: 'Artikelnummer / SKU', name: 'Produktname', model: 'Modell', ean: 'EAN',
  brand: 'Marke', manufacturer: 'Hersteller', manufacturer_sku: 'Hersteller-SKU',
  product_family: 'Produktfamilie', revision: 'Revision', hero_image_url: 'Hauptbild',
  ce_status: 'CE Status', mdr_status: 'MDR Status',
};

export default function ArtikelAbgleich() {
  const nav = useNavigate();
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => ['Super Admin', 'Admin', 'Marketing', 'Produktion'].includes(r));

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [q, setQ] = useState('');
  const [fOrigin, setFOrigin] = useState('all');
  const [fVerdict, setFVerdict] = useState('all');
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<any>(null);
  const [pick, setPick] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const [p, c, d] = await Promise.all([
      db.from('ph_products').select('*'),
      db.from('catalog_items').select('id, sku, name, short_name, ean, brand, manufacturer, model, internal_number, item_type, status'),
      db.from('plm_devices').select('id, article_number, name, product_family, revision, ce_status, mdr_status, image_url, is_active'),
    ]);
    setProducts(p.data || []);
    const rows: SourceRow[] = [
      ...(c.data || []).map((x: any) => ({
        key: `catalog:${x.id}`, origin: 'catalog' as const, id: x.id, sku: x.sku, name: x.name,
        fields: {
          sku: x.sku, name: x.name, model: x.model, ean: x.ean, brand: x.brand,
          manufacturer: x.manufacturer, manufacturer_sku: x.internal_number,
        },
      })),
      ...(d.data || []).map((x: any) => ({
        key: `plm:${x.id}`, origin: 'plm' as const, id: x.id, sku: x.article_number, name: x.name,
        fields: {
          sku: x.article_number, name: x.name, product_family: x.product_family, revision: x.revision,
          ce_status: x.ce_status, mdr_status: x.mdr_status, hero_image_url: x.image_url,
        },
      })),
    ];
    setSources(rows);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const analysed = useMemo(() => sources.map(s => {
    const master = products.find(p =>
      (s.origin === 'catalog' && p.catalog_item_id === s.id) ||
      (s.origin === 'plm' && p.plm_device_id === s.id),
    ) || products.find(p => s.sku && norm(p.sku) === norm(s.sku))
      || products.find(p => s.sku && norm(p.manufacturer_sku) === norm(s.sku))
      || products.find(p => s.name && norm(p.name) === norm(s.name));

    if (!master) return { s, master: null, diffs: [] as Diff[], verdict: 'neu' as Verdict };

    const diffs: Diff[] = [];
    Object.entries(s.fields).forEach(([field, value]) => {
      if (value === null || value === undefined || value === '') return;
      const cur = master[field];
      if (cur === null || cur === undefined || cur === '') {
        diffs.push({ field, label: FIELD_LABELS[field] || field, source: value, master: cur, kind: 'fill' });
      } else if (norm(String(cur)) !== norm(String(value))) {
        diffs.push({ field, label: FIELD_LABELS[field] || field, source: value, master: cur, kind: 'conflict' });
      }
    });
    const verdict: Verdict = !diffs.length ? 'identisch'
      : diffs.some(d => d.kind === 'conflict') ? 'konflikt' : 'uebernehmen';
    return { s, master, diffs, verdict };
  }), [sources, products]);

  const filtered = useMemo(() => analysed.filter(r => {
    if (fOrigin !== 'all' && r.s.origin !== fOrigin) return false;
    if (fVerdict !== 'all' && r.verdict !== fVerdict) return false;
    if (q) {
      const t = `${r.s.sku} ${r.s.name} ${r.master?.name ?? ''} ${r.master?.sku ?? ''}`.toLowerCase();
      if (!t.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [analysed, fOrigin, fVerdict, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { neu: 0, uebernehmen: 0, konflikt: 0, identisch: 0 };
    analysed.forEach(r => { c[r.verdict]++; });
    return c;
  }, [analysed]);

  const openDetail = (r: any) => {
    setDetail(r);
    const p: Record<string, boolean> = {};
    r.diffs.forEach((d: Diff) => { p[d.field] = d.kind === 'fill'; });
    setPick(p);
  };

  const createFromSource = async (r: any) => {
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
    const row: Record<string, any> = {
      ...r.s.fields, status: 'draft',
      catalog_item_id: r.s.origin === 'catalog' ? r.s.id : null,
      plm_device_id: r.s.origin === 'plm' ? r.s.id : null,
      created_by: uid, updated_by: uid,
    };
    Object.keys(row).forEach(k => { if (row[k] === null || row[k] === '') delete row[k]; });
    if (!row.name) throw new Error('Quelle ohne Produktname');
    const { data, error } = await db.from('ph_products').insert(row).select('id').single();
    if (error) throw error;
    return data.id as string;
  };

  const applyDiffs = async (r: any, fields: string[]) => {
    if (!fields.length) return;
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
    const patch: Record<string, any> = { updated_by: uid };
    fields.forEach(f => { patch[f] = r.s.fields[f]; });
    patch[r.s.origin === 'catalog' ? 'catalog_item_id' : 'plm_device_id'] = r.s.id;
    const { error } = await db.from('ph_products').update(patch).eq('id', r.master.id);
    if (error) throw error;
  };

  const runSelected = async () => {
    const rows = filtered.filter(r => sel[r.s.key]);
    if (!rows.length) return toast.error('Keine Zeilen ausgewählt');
    setBusy(true);
    let created = 0, updated = 0, skipped = 0;
    try {
      for (const r of rows) {
        if (r.verdict === 'neu') { await createFromSource(r); created++; }
        else if (r.verdict === 'uebernehmen') {
          await applyDiffs(r, r.diffs.filter(d => d.kind === 'fill').map(d => d.field)); updated++;
        } else skipped++;
      }
      toast.success(`${created} neu angelegt, ${updated} ergänzt, ${skipped} übersprungen (Konflikte einzeln prüfen)`);
      setSel({});
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Abgleich fehlgeschlagen');
    } finally { setBusy(false); }
  };

  const applyDetail = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      if (detail.verdict === 'neu') {
        const id = await createFromSource(detail);
        toast.success('Artikel angelegt');
        setDetail(null);
        nav(`/artikel/${id}`);
        return;
      }
      await applyDiffs(detail, Object.keys(pick).filter(k => pick[k]));
      toast.success('Felder übernommen');
      setDetail(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Übernahme fehlgeschlagen');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import- & Mapping-Assistent"
        subtitle="Abgleich Katalog und PLM-Geräte gegen den ALIX PRODUCT MASTER – nichts wird automatisch überschrieben."
        icon={ArrowRightLeft}
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Neu prüfen
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {(Object.keys(VERDICTS) as Verdict[]).map(v => (
          <Card key={v} className={fVerdict === v ? 'ring-1 ring-primary' : ''}>
            <CardContent className="p-4 cursor-pointer" onClick={() => setFVerdict(fVerdict === v ? 'all' : v)}>
              <div className="text-xs text-muted-foreground">{VERDICTS[v].label}</div>
              <div className="text-2xl font-semibold">{counts[v] ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Suche SKU, Name…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <Select value={fOrigin} onValueChange={setFOrigin}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Quellen</SelectItem>
                <SelectItem value="catalog">Katalog</SelectItem>
                <SelectItem value="plm">PLM-Geräte</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fVerdict} onValueChange={setFVerdict}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Ergebnisse</SelectItem>
                {(Object.keys(VERDICTS) as Verdict[]).map(v => (
                  <SelectItem key={v} value={v}>{VERDICTS[v].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canWrite && (
              <Button onClick={runSelected} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                Auswahl übernehmen
              </Button>
            )}
          </div>

          <ScrollArea className="max-h-[62vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Artikelnummer</TableHead>
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead>Master-Treffer</TableHead>
                  <TableHead>Ergebnis</TableHead>
                  <TableHead className="text-right">Abweichungen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>}
                {!loading && !filtered.length && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Keine Datensätze</TableCell></TableRow>}
                {filtered.map(r => (
                  <TableRow key={r.s.key} className="cursor-pointer" onClick={() => openDetail(r)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={!!sel[r.s.key]}
                        disabled={r.verdict === 'identisch'}
                        onCheckedChange={v => setSel(p => ({ ...p, [r.s.key]: !!v }))}
                      />
                    </TableCell>
                    <TableCell><Badge variant="outline">{r.s.origin === 'catalog' ? 'Katalog' : 'PLM'}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{r.s.sku || '—'}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{r.s.name || '—'}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">{r.master?.name || '—'}</TableCell>
                    <TableCell><Badge className={VERDICTS[r.verdict].tone}>{VERDICTS[r.verdict].label}</Badge></TableCell>
                    <TableCell className="text-right">{r.diffs.length || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detail?.s?.name || 'Abgleich'}</DialogTitle>
          </DialogHeader>
          {detail?.verdict === 'neu' ? (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">Kein Treffer im Product Master. Der Artikel wird als Entwurf neu angelegt.</p>
              {Object.entries(detail.s.fields).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b py-1">
                  <span className="text-muted-foreground">{FIELD_LABELS[k] || k}</span>
                  <span className="font-medium">{String(v)}</span>
                </div>
              ))}
            </div>
          ) : (
            <ScrollArea className="max-h-[55vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Feld</TableHead>
                    <TableHead>Master (aktuell)</TableHead>
                    <TableHead>Quelle (neu)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detail?.diffs || []).map((d: Diff) => (
                    <TableRow key={d.field} className={d.kind === 'conflict' ? 'bg-destructive/5' : ''}>
                      <TableCell>
                        <Checkbox checked={!!pick[d.field]} onCheckedChange={v => setPick(p => ({ ...p, [d.field]: !!v }))} />
                      </TableCell>
                      <TableCell>{d.label}</TableCell>
                      <TableCell className="text-muted-foreground">{d.master ? String(d.master) : '—'}</TableCell>
                      <TableCell className="font-medium">{String(d.source)}</TableCell>
                    </TableRow>
                  ))}
                  {!detail?.diffs?.length && (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Keine Abweichungen</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
          <DialogFooter>
            {detail?.master && (
              <Button variant="outline" onClick={() => { const id = detail.master.id; setDetail(null); nav(`/artikel/${id}`); }}>
                Produktakte öffnen
              </Button>
            )}
            <Button variant="ghost" onClick={() => setDetail(null)}>Abbrechen</Button>
            {canWrite && (
              <Button onClick={applyDetail} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {detail?.verdict === 'neu' ? 'Artikel anlegen' : 'Ausgewählte Felder übernehmen'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
