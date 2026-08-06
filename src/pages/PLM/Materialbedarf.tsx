import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Calculator, Loader2, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Row { id: string; [k: string]: any }

const ACTIVE_STATUS = ['geplant', 'material_bereit', 'in_fertigung'];
const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);
const num = (n: any) => Number(n ?? 0) || 0;

export default function PlmMaterialbedarf() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Row[]>([]);
  const [devices, setDevices] = useState<Row[]>([]);
  const [bom, setBom] = useState<Row[]>([]);
  const [parts, setParts] = useState<Row[]>([]);
  const [receipts, setReceipts] = useState<Row[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [o, d, b, p, g] = await Promise.all([
        supabase.from('plm_production_orders' as any).select('*').in('status', ACTIVE_STATUS).limit(500),
        supabase.from('plm_devices' as any).select('id,name,article_number').limit(500),
        supabase.from('plm_bom_items' as any).select('*').limit(5000),
        supabase.from('plm_parts' as any).select('id,name,part_number,price,lead_time_days,moq,stock_min,blocked,primary_supplier_id').limit(5000),
        supabase.from('plm_goods_receipts' as any).select('part_id,quantity,blocked,inspection_result').limit(5000),
      ]);
      const err = o.error || d.error || b.error || p.error || g.error;
      if (err) toast.error(err.message);
      setOrders((o.data as any[]) || []);
      setDevices((d.data as any[]) || []);
      setBom((b.data as any[]) || []);
      setParts((p.data as any[]) || []);
      setReceipts((g.data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  const deviceMap = useMemo(() => Object.fromEntries(devices.map(d => [d.id, d])), [devices]);
  const partMap = useMemo(() => Object.fromEntries(parts.map(p => [p.id, p])), [parts]);

  // Verfügbarer Bestand = freigegebene, nicht gesperrte Wareneingänge
  const stockMap = useMemo(() => {
    const m: Record<string, number> = {};
    receipts.forEach(r => {
      if (r.blocked) return;
      if (r.inspection_result && ['abweichung', 'gesperrt', 'rueckgesendet'].includes(r.inspection_result)) return;
      m[r.part_id] = (m[r.part_id] || 0) + num(r.quantity);
    });
    return m;
  }, [receipts]);

  // BOM-Explosion je Gerät → Teilebedarf pro Stück
  const demandPerDevice = useMemo(() => {
    const cache: Record<string, Record<string, number>> = {};
    const explodeAssembly = (assemblyId: string, factor: number, acc: Record<string, number>, seen: Set<string>) => {
      if (seen.has(assemblyId)) return;
      seen.add(assemblyId);
      bom.filter(b => b.assembly_id === assemblyId).forEach(it => {
        const q = (num(it.quantity) || 1) * factor;
        if (it.child_assembly_id) explodeAssembly(it.child_assembly_id, q, acc, new Set(seen));
        else if (it.part_id) acc[it.part_id] = (acc[it.part_id] || 0) + q;
      });
    };
    devices.forEach(d => {
      const acc: Record<string, number> = {};
      bom.filter(b => b.device_id === d.id && !b.assembly_id).forEach(it => {
        const q = num(it.quantity) || 1;
        if (it.child_assembly_id) explodeAssembly(it.child_assembly_id, q, acc, new Set());
        else if (it.part_id) acc[it.part_id] = (acc[it.part_id] || 0) + q;
      });
      cache[d.id] = acc;
    });
    return cache;
  }, [bom, devices]);

  const rows = useMemo(() => {
    const need: Record<string, number> = {};
    orders.forEach(o => {
      const per = demandPerDevice[o.device_id] || {};
      const qty = num(o.quantity) || 1;
      Object.entries(per).forEach(([partId, q]) => { need[partId] = (need[partId] || 0) + q * qty; });
    });
    return Object.entries(need)
      .map(([partId, required]) => {
        const part = partMap[partId];
        const stock = stockMap[partId] || 0;
        const shortage = Math.max(0, required - stock);
        const orderQty = shortage > 0 ? Math.max(shortage, num(part?.moq)) : 0;
        return {
          partId,
          name: part?.name || 'Unbekanntes Teil',
          partNumber: part?.part_number || '—',
          blocked: !!part?.blocked,
          leadTime: part?.lead_time_days ?? null,
          required,
          stock,
          shortage,
          orderQty,
          cost: orderQty * num(part?.price),
        };
      })
      .filter(r => {
        const s = search.trim().toLowerCase();
        return !s || r.name.toLowerCase().includes(s) || r.partNumber.toLowerCase().includes(s);
      })
      .sort((a, b) => b.shortage - a.shortage || a.name.localeCompare(b.name));
  }, [orders, demandPerDevice, partMap, stockMap, search]);

  const shortageRows = rows.filter(r => r.shortage > 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Materialbedarf (MRP)"
        subtitle="Bedarfsermittlung aus offenen Produktionsaufträgen über die mehrstufige Stückliste."
        icon={Calculator}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Offene Produktionsaufträge', value: orders.length },
          { label: 'Benötigte Teilepositionen', value: rows.length },
          { label: 'Unterdeckung', value: shortageRows.length },
          { label: 'Beschaffungswert', value: fmt(totalCost) },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground">{k.label}</div>
              <div className="mt-1 text-2xl font-semibold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Teil oder Teilenummer suchen…"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Bedarf wird berechnet…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              Kein Materialbedarf – keine offenen Produktionsaufträge oder keine Stücklistenpositionen.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teil</TableHead>
                  <TableHead>Teilenummer</TableHead>
                  <TableHead className="text-right">Bedarf</TableHead>
                  <TableHead className="text-right">Bestand</TableHead>
                  <TableHead className="text-right">Unterdeckung</TableHead>
                  <TableHead className="text-right">Bestellmenge</TableHead>
                  <TableHead className="text-right">Lieferzeit</TableHead>
                  <TableHead className="text-right">Wert</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.partId}>
                    <TableCell className="flex items-center gap-2">
                      {r.blocked && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      {r.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.partNumber}</TableCell>
                    <TableCell className="text-right">{r.required}</TableCell>
                    <TableCell className="text-right">{r.stock}</TableCell>
                    <TableCell className="text-right">
                      {r.shortage > 0
                        ? <Badge variant="outline" className="border-destructive/50 text-destructive">{r.shortage}</Badge>
                        : <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">gedeckt</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{r.orderQty || '—'}</TableCell>
                    <TableCell className="text-right">{r.leadTime != null ? `${r.leadTime} T` : '—'}</TableCell>
                    <TableCell className="text-right">{r.cost ? fmt(r.cost) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
