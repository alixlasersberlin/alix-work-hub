import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Upload, Loader2, FileSpreadsheet } from 'lucide-react';
import { BomRow, mapRows, normalizeManufacturer } from '@/lib/plm/manufacturers';
import { useAuth } from '@/hooks/useAuth';

const WRITE_ROLES = ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical', 'Produktion', 'QM'];

export default function PlmBomImport() {
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => WRITE_ROLES.includes(r));
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<BomRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [existing, setExisting] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const manufacturers = useMemo(() => {
    const set = new Map<string, string>();
    rows.forEach(r => { if (r.manufacturer) set.set(normalizeManufacturer(r.manufacturer), r.manufacturer); });
    return [...set.entries()].map(([norm, name]) => ({ norm, name }));
  }, [rows]);

  const known = useMemo(() => new Set(existing.map(e => e.name_normalized || normalizeManufacturer(e.name))), [existing]);
  const newOnes = manufacturers.filter(m => !known.has(m.norm));
  const existingOnes = manufacturers.filter(m => known.has(m.norm));

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name); setAnalyzing(true); setResult(null);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });
      const mapped = mapRows(raw);
      if (!mapped.length) toast.error('Keine verwertbaren Zeilen erkannt — bitte Spaltenüberschriften prüfen.');
      setRows(mapped);
      const { data } = await (supabase.from('plm_manufacturers' as any) as any).select('id,name,name_normalized').limit(3000);
      setExisting((data as any[]) || []);
    } catch (err: any) {
      toast.error(err?.message || 'Datei konnte nicht gelesen werden');
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function runImport() {
    if (!rows.length) return;
    setImporting(true);
    try {
      // 1) Hersteller anlegen / laden
      if (newOnes.length) {
        const { error } = await (supabase.from('plm_manufacturers' as any) as any)
          .insert(newOnes.map(m => ({ name: m.name, approval_status: 'bedingt_freigegeben', is_active: true })));
        if (error) throw error;
      }
      const { data: allMfr } = await (supabase.from('plm_manufacturers' as any) as any).select('id,name,name_normalized').limit(5000);
      const mfrMap = new Map((allMfr as any[] || []).map(m => [m.name_normalized || normalizeManufacturer(m.name), m.id]));

      // 2) Lieferanten anlegen / laden
      const supplierNames = [...new Set(rows.map(r => (r.supplier || '').trim()).filter(Boolean))];
      const { data: allSup } = await (supabase.from('plm_suppliers' as any) as any).select('id,name').limit(5000);
      const supMap = new Map((allSup as any[] || []).map(s => [String(s.name).toLowerCase(), s.id]));
      const missingSup = supplierNames.filter(n => !supMap.has(n.toLowerCase()));
      if (missingSup.length) {
        const { data: ins, error } = await (supabase.from('plm_suppliers' as any) as any)
          .insert(missingSup.map(n => ({ name: n, is_active: true }))).select('id,name');
        if (error) throw error;
        (ins as any[] || []).forEach(s => supMap.set(String(s.name).toLowerCase(), s.id));
      }

      // 3) Geräte laden
      const { data: devices } = await (supabase.from('plm_devices' as any) as any).select('id,name,article_number').limit(2000);
      const devMap = new Map((devices as any[] || []).flatMap(d => [
        [String(d.name || '').toLowerCase(), d.id],
        [String(d.article_number || '').toLowerCase(), d.id],
      ] as any));

      // 4) Bauteile upsert (Materialstamm: Teilenummer eindeutig)
      const { data: allParts } = await (supabase.from('plm_parts' as any) as any).select('id,part_number,name').limit(10000);
      const partMap = new Map((allParts as any[] || []).map(p => [String(p.part_number || p.name).toLowerCase(), p.id]));

      let createdParts = 0, updatedParts = 0, bomRows = 0;
      for (const r of rows) {
        const key = String(r.part_number || r.part_name || '').toLowerCase();
        if (!key) continue;
        const payload: any = {
          part_number: r.part_number || null,
          name: r.part_name || r.part_number,
          manufacturer_id: r.manufacturer ? mfrMap.get(normalizeManufacturer(r.manufacturer)) ?? null : null,
          manufacturer: r.manufacturer || null,
          manufacturer_part_number: r.manufacturer_part_number || null,
          original_part_number: r.original_part_number || null,
          supplier_part_number: r.supplier_part_number || null,
          primary_supplier_id: r.supplier ? supMap.get(r.supplier.toLowerCase()) ?? null : null,
        };
        let partId = partMap.get(key);
        if (partId) {
          const { error } = await (supabase.from('plm_parts' as any) as any).update(payload).eq('id', partId);
          if (error) throw error;
          updatedParts++;
        } else {
          const { data, error } = await (supabase.from('plm_parts' as any) as any).insert(payload).select('id').maybeSingle();
          if (error) throw error;
          partId = (data as any)?.id;
          partMap.set(key, partId);
          createdParts++;
        }

        // 5) Hersteller ⇄ Lieferant verknüpfen
        const mId = payload.manufacturer_id, sId = payload.primary_supplier_id;
        if (mId && sId) {
          await (supabase.from('plm_manufacturer_suppliers' as any) as any)
            .upsert({ manufacturer_id: mId, supplier_id: sId }, { onConflict: 'manufacturer_id,supplier_id' });
        }

        // 6) BOM-Position
        const devId = r.device ? devMap.get(String(r.device).toLowerCase()) : null;
        if (devId && partId) {
          const { error } = await (supabase.from('plm_bom_items' as any) as any).insert({
            device_id: devId, part_id: partId,
            position_no: r.position_no ?? null,
            quantity: r.quantity ?? null,
            unit: r.unit || 'Stk',
          });
          if (!error) bomRows++;
        }
      }

      setResult(`${createdParts} neue Bauteile · ${updatedParts} aktualisiert · ${newOnes.length} neue Hersteller · ${bomRows} Stücklistenpositionen`);
      toast.success('Import abgeschlossen');
      setRows([]);
    } catch (e: any) {
      toast.error(e?.message || 'Import fehlgeschlagen');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="container max-w-[1400px] py-6 space-y-6">
      <PageHeader icon={FileSpreadsheet} title="BOM- & Hersteller-Import" subtitle="Excel/CSV-Stücklisten importieren — Hersteller, Lieferanten und Bauteile werden automatisch erkannt und angelegt." noBreadcrumbs />

      <Card>
        <CardHeader><CardTitle className="text-base">Datei wählen (XLSX / XLS / CSV)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={analyzing || !canWrite}>
            {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Datei hochladen
          </Button>
          {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
          <p className="text-xs text-muted-foreground">
            Erkannte Spalten: Manufacturer, Manufacturer Part Number, Part Number, Part Name, Supplier,
            Supplier Part Number, Quantity, Unit, Device, Position.
          </p>
          {!canWrite && <p className="text-xs text-destructive">Keine Schreibberechtigung für Produktion &amp; Beschaffung.</p>}
        </CardContent>
      </Card>

      {result && (
        <Card className="border-emerald-500/40 bg-emerald-500/5"><CardContent className="p-4 text-sm">{result}</CardContent></Card>
      )}

      {rows.length > 0 && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Zusammenfassung</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{rows.length} Positionen gefunden</p>
              <p>{manufacturers.length} Hersteller erkannt</p>
              <p>{existingOnes.length} Hersteller bereits vorhanden</p>
              <p className="text-amber-500">{newOnes.length} neue Hersteller</p>
              <div className="flex flex-wrap gap-2 pt-2">
                {newOnes.slice(0, 30).map(m => <Badge key={m.norm} variant="outline" className="border-amber-500/40 text-amber-500">{m.name}</Badge>)}
              </div>
              <Button className="mt-4" onClick={runImport} disabled={importing || !canWrite}>
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Import starten
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Vorschau (erste 20 Zeilen)</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Hersteller</TableHead><TableHead>MPN</TableHead><TableHead>Teilenummer</TableHead>
                  <TableHead>Bezeichnung</TableHead><TableHead>Lieferant</TableHead><TableHead>Menge</TableHead>
                  <TableHead>Einheit</TableHead><TableHead>Gerät</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.slice(0, 20).map((r, i) => (
                    <TableRow key={i} className="text-sm">
                      <TableCell>{r.manufacturer || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{r.manufacturer_part_number || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{r.part_number || '—'}</TableCell>
                      <TableCell>{r.part_name || '—'}</TableCell>
                      <TableCell>{r.supplier || '—'}</TableCell>
                      <TableCell>{r.quantity ?? '—'}</TableCell>
                      <TableCell>{r.unit || '—'}</TableCell>
                      <TableCell>{r.device || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
