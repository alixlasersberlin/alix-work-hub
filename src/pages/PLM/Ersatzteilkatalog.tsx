import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LifeBuoy, Loader2, Search, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { plmLabel } from '@/lib/plm/config';

interface Row { id: string; [k: string]: any }
const num = (n: any) => Number(n ?? 0) || 0;
const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);

export default function PlmErsatzteilkatalog() {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Row[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [bom, setBom] = useState<Row[]>([]);
  const [parts, setParts] = useState<Row[]>([]);
  const [assemblies, setAssemblies] = useState<Row[]>([]);
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [onlySpare, setOnlySpare] = useState(true);

  useEffect(() => {
    (async () => {
      const [d, b, p, a, s] = await Promise.all([
        supabase.from('plm_devices' as any).select('id,name,article_number').order('article_number').limit(500),
        supabase.from('plm_bom_items' as any).select('*').limit(5000),
        supabase.from('plm_parts' as any).select('*').limit(5000),
        supabase.from('plm_assemblies' as any).select('id,name,code,device_id').limit(2000),
        supabase.from('plm_suppliers' as any).select('id,name').limit(1000),
      ]);
      const err = d.error || b.error || p.error || a.error || s.error;
      if (err) toast.error(err.message);
      const list = (d.data as any[]) || [];
      setDevices(list);
      setDeviceId(list[0]?.id || '');
      setBom((b.data as any[]) || []);
      setParts((p.data as any[]) || []);
      setAssemblies((a.data as any[]) || []);
      setSuppliers((s.data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  const partMap = useMemo(() => Object.fromEntries(parts.map(p => [p.id, p])), [parts]);
  const asmMap = useMemo(() => Object.fromEntries(assemblies.map(a => [a.id, a])), [assemblies]);
  const supMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);

  // Alle Teile eines Geräts inkl. Baugruppen-Positionen
  const rows = useMemo(() => {
    if (!deviceId) return [];
    const deviceAsmIds = new Set(assemblies.filter(a => a.device_id === deviceId).map(a => a.id));
    const items = bom.filter(b => b.part_id && (b.device_id === deviceId || deviceAsmIds.has(b.assembly_id)));
    const agg: Record<string, { part: Row; qty: number; positions: string[]; assembly?: Row }> = {};
    items.forEach(it => {
      const part = partMap[it.part_id];
      if (!part) return;
      const e = agg[it.part_id] || (agg[it.part_id] = { part, qty: 0, positions: [], assembly: asmMap[it.assembly_id] });
      e.qty += num(it.quantity) || 1;
      if (it.position_no) e.positions.push(String(it.position_no));
    });
    return Object.values(agg).sort((a, b) => (a.part.part_number || '').localeCompare(b.part.part_number || ''));
  }, [deviceId, bom, partMap, asmMap, assemblies]);

  const filtered = rows.filter(r => {
    if (onlySpare && !r.part.is_spare_part) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return `${r.part.part_number || ''} ${r.part.name || ''} ${r.part.manufacturer || ''}`.toLowerCase().includes(s);
  });

  const device = devices.find(d => d.id === deviceId);
  const totalValue = filtered.reduce((sum, r) => sum + num(r.part.price) * r.qty, 0);

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <PageHeader
        icon={LifeBuoy}
        title="Ersatzteilkatalog"
        subtitle="Servicerelevante Teile je Gerät mit Positionsnummern, Bezugsquelle und Preisen."
        noBreadcrumbs
      />

      <Card className="print:hidden">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <select
            value={deviceId}
            onChange={e => setDeviceId(e.target.value)}
            className="h-10 min-w-[260px] rounded-md border border-input bg-background px-3 text-sm"
          >
            {devices.map(d => (
              <option key={d.id} value={d.id}>{d.article_number ? `${d.article_number} — ` : ''}{d.name}</option>
            ))}
          </select>
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Teil, Nummer, Hersteller …" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={onlySpare} onChange={e => setOnlySpare(e.target.checked)} />
            nur Ersatzteile
          </label>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Drucken
          </Button>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Gerät</div><div className="mt-1 font-semibold">{device?.name || '—'}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Positionen</div><div className="mt-1 text-2xl font-semibold">{filtered.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Materialwert</div><div className="mt-1 text-2xl font-semibold">{fmt(totalValue)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pos.</TableHead><TableHead>Teilenummer</TableHead><TableHead>Bezeichnung</TableHead>
                <TableHead>Baugruppe</TableHead><TableHead className="text-right">Menge</TableHead>
                <TableHead>Hersteller</TableHead><TableHead>Lieferant</TableHead>
                <TableHead className="text-right">Preis</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-muted-foreground">Keine Teile gefunden.</TableCell></TableRow>}
              {filtered.map(r => (
                <TableRow key={r.part.id}>
                  <TableCell className="font-mono text-xs">{r.positions.join(', ') || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{r.part.part_number || '—'}</TableCell>
                  <TableCell>{r.part.name}</TableCell>
                  <TableCell>{r.assembly?.name || '—'}</TableCell>
                  <TableCell className="text-right">{r.qty}</TableCell>
                  <TableCell>{r.part.manufacturer || '—'}</TableCell>
                  <TableCell>{supMap[r.part.primary_supplier_id]?.name || '—'}</TableCell>
                  <TableCell className="text-right">{r.part.price ? fmt(num(r.part.price)) : '—'}</TableCell>
                  <TableCell>
                    {r.part.blocked
                      ? <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">gesperrt</Badge>
                      : <span className="text-muted-foreground text-xs">{plmLabel(r.part.release_status)}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
