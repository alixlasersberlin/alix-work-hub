import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { UploadCloud, Play, CheckCircle2, AlertTriangle } from 'lucide-react';

// Sehr einfacher CSV-Parser (Komma oder Semikolon, Anführungszeichen)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = '', inQ = false, row: string[] = [];
  const first = text.split(/\r?\n/)[0] ?? '';
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i+1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch === '\r') { /* skip */ }
      else cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim().length));
}

type Row = { sku: string; name: string; brand?: string; model?: string; status?: string; category?: string; note?: string; _issue?: string; _willUpdate?: boolean };

export default function KatalogImportCsv() {
  const c = supabase as any;
  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ inserted: number; updated: number; skipped: number } | null>(null);

  const handleFile = async (file: File) => {
    const text = await file.text();
    setRaw(text);
    parseAndPreview(text);
  };

  const parseAndPreview = async (text: string) => {
    setResult(null);
    const grid = parseCsv(text);
    if (grid.length < 2) { toast.error('Keine Datenzeilen erkannt.'); setRows([]); return; }
    const header = grid[0].map(h => h.trim().toLowerCase());
    const idxSku = header.findIndex(h => ['sku', 'artikelnummer', 'nummer'].includes(h));
    const idxName = header.findIndex(h => ['name', 'bezeichnung', 'title'].includes(h));
    if (idxSku < 0 || idxName < 0) { toast.error('Spalten "sku" und "name" sind erforderlich.'); return; }
    const idxBrand = header.findIndex(h => h === 'brand' || h === 'marke');
    const idxModel = header.findIndex(h => h === 'model' || h === 'modell');
    const idxStatus = header.findIndex(h => h === 'status');
    const idxCat = header.findIndex(h => h === 'category' || h === 'kategorie');
    const idxNote = header.findIndex(h => h === 'note' || h === 'notiz' || h === 'notes_internal');

    const parsed: Row[] = grid.slice(1).map(r => ({
      sku: (r[idxSku] ?? '').trim(),
      name: (r[idxName] ?? '').trim(),
      brand: idxBrand >= 0 ? (r[idxBrand] ?? '').trim() : undefined,
      model: idxModel >= 0 ? (r[idxModel] ?? '').trim() : undefined,
      status: idxStatus >= 0 ? (r[idxStatus] ?? '').trim() : undefined,
      category: idxCat >= 0 ? (r[idxCat] ?? '').trim() : undefined,
      note: idxNote >= 0 ? (r[idxNote] ?? '').trim() : undefined,
    })).filter(x => x.sku || x.name);

    // Validate + check existing SKUs
    const skus = parsed.map(r => r.sku).filter(Boolean);
    const { data: existing } = await c.from('catalog_items').select('sku').in('sku', skus);
    const existingSet = new Set((existing ?? []).map((x: any) => x.sku));
    const validated = parsed.map(r => {
      let issue: string | undefined;
      if (!r.sku) issue = 'SKU fehlt';
      else if (!r.name) issue = 'Name fehlt';
      return { ...r, _issue: issue, _willUpdate: existingSet.has(r.sku) };
    });
    setRows(validated);
    toast.success(`${validated.length} Zeilen geparst · ${validated.filter(x => x._willUpdate).length} Updates · ${validated.filter(x => !x._willUpdate && !x._issue).length} neu`);
  };

  const runImport = async () => {
    setRunning(true);
    setResult(null);
    let inserted = 0, updated = 0, skipped = 0;
    try {
      for (const r of rows) {
        if (r._issue) { skipped++; continue; }
        const payload: any = {
          sku: r.sku, name: r.name,
          brand: r.brand || null, model: r.model || null,
          status: r.status || 'entwurf', notes_internal: r.note || null,
        };
        if (r._willUpdate) {
          const { error } = await c.from('catalog_items').update(payload).eq('sku', r.sku);
          if (error) { skipped++; continue; }
          updated++;
        } else {
          const { error } = await c.from('catalog_items').insert(payload);
          if (error) { skipped++; continue; }
          inserted++;
        }
      }
      setResult({ inserted, updated, skipped });
      toast.success(`Import fertig: ${inserted} neu, ${updated} aktualisiert, ${skipped} übersprungen`);
    } finally {
      setRunning(false);
    }
  };

  const okCount = useMemo(() => rows.filter(r => !r._issue).length, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UploadCloud className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Katalog-Import (CSV)</h2>
        <Badge variant="outline" className="ml-2 text-xs">Vorschau vor Import</Badge>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">1) CSV hochladen oder einfügen</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="max-w-md" />
            <Button variant="outline" size="sm" onClick={() => parseAndPreview(raw)} disabled={!raw.trim()}>
              Vorschau aktualisieren
            </Button>
          </div>
          <div>
            <Label>CSV-Inhalt (Komma oder Semikolon, erste Zeile = Spaltennamen)</Label>
            <Textarea rows={6} value={raw} onChange={(e) => setRaw(e.target.value)}
              placeholder={'sku;name;brand;model;status;category;note\nABC-100;Muster;Brand;M1;entwurf;Laser;Interne Notiz'} className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground mt-1">
              Erforderlich: <code>sku</code>, <code>name</code>. Optional: <code>brand</code>, <code>model</code>, <code>status</code>, <code>category</code>, <code>note</code>.
              Einkaufspreis-Spalten werden bewusst ignoriert.
            </p>
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">2) Vorschau ({rows.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{okCount} importierbar</Badge>
              <Button onClick={runImport} disabled={running || okCount === 0} size="sm">
                <Play className="h-4 w-4 mr-1" /> {running ? 'Importiere…' : 'Import starten'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-[500px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Marke / Modell</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i} className={r._issue ? 'bg-destructive/10' : ''}>
                    <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{[r.brand, r.model].filter(Boolean).join(' · ')}</TableCell>
                    <TableCell className="text-xs">{r.status ?? 'entwurf'}</TableCell>
                    <TableCell className="text-xs">{r.category ?? ''}</TableCell>
                    <TableCell>
                      {r._issue ? (
                        <span className="inline-flex items-center gap-1 text-destructive text-xs"><AlertTriangle className="h-3 w-3" />{r._issue}</span>
                      ) : r._willUpdate ? (
                        <Badge variant="outline" className="text-[10px]">Update</Badge>
                      ) : (
                        <Badge className="text-[10px]">Neu</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <div className="text-sm">
              <span className="font-semibold">Import abgeschlossen:</span> {result.inserted} neu · {result.updated} aktualisiert · {result.skipped} übersprungen
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
