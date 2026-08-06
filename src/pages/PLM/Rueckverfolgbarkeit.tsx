import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { ScanSearch, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { plmLabel, statusTone } from '@/lib/plm/config';

interface Row { id: string; [k: string]: any }

const toneClass = (t: ReturnType<typeof statusTone>) =>
  t === 'ok' ? 'border-emerald-500/40 text-emerald-500'
    : t === 'bad' ? 'border-destructive/50 text-destructive'
      : t === 'muted' ? 'border-muted-foreground/30 text-muted-foreground'
        : 'border-amber-500/40 text-amber-500';

const listOf = (v: any): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? v.split(',').map(s => s.trim()) : [];

export default function PlmRueckverfolgbarkeit() {
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<Row[]>([]);
  const [orders, setOrders] = useState<Row[]>([]);
  const [parts, setParts] = useState<Row[]>([]);
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [devices, setDevices] = useState<Row[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [g, o, p, s, d] = await Promise.all([
        supabase.from('plm_goods_receipts' as any).select('*').order('received_at', { ascending: false }).limit(2000),
        supabase.from('plm_production_orders' as any).select('*').order('created_at', { ascending: false }).limit(2000),
        supabase.from('plm_parts' as any).select('id,name,part_number').limit(5000),
        supabase.from('plm_suppliers' as any).select('id,name,supplier_number').limit(2000),
        supabase.from('plm_devices' as any).select('id,name,article_number').limit(1000),
      ]);
      const err = g.error || o.error || p.error || s.error || d.error;
      if (err) toast.error(err.message);
      setReceipts((g.data as any[]) || []);
      setOrders((o.data as any[]) || []);
      setParts((p.data as any[]) || []);
      setSuppliers((s.data as any[]) || []);
      setDevices((d.data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  const partMap = useMemo(() => Object.fromEntries(parts.map(p => [p.id, p])), [parts]);
  const supMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const devMap = useMemo(() => Object.fromEntries(devices.map(d => [d.id, d])), [devices]);

  const q = search.trim().toLowerCase();
  const hit = (...vals: any[]) => !q || vals.some(v => String(v ?? '').toLowerCase().includes(q));

  const receiptRows = useMemo(() => receipts.filter(r => {
    const part = partMap[r.part_id];
    return hit(r.receipt_number, r.batch_number, r.lot_number, part?.name, part?.part_number, ...listOf(r.serial_numbers));
  }), [receipts, partMap, q]);

  const orderRows = useMemo(() => orders.filter(o => {
    const dev = devMap[o.device_id];
    return hit(o.order_number, o.batch_number, dev?.name, dev?.article_number, ...listOf(o.serial_numbers));
  }), [orders, devMap, q]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Rückverfolgbarkeit"
        subtitle="Chargen-, Los- und Seriennummern über Wareneingang und Produktionsaufträge (MDR / ISO 13485)."
        icon={ScanSearch}
      />

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Seriennummer, Charge, Los, Teil oder Gerät suchen…"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Daten werden geladen…
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="border-b p-4 text-sm font-medium">
                Wareneingang <span className="text-muted-foreground">({receiptRows.length})</span>
              </div>
              {receiptRows.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Keine Treffer im Wareneingang.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>WE-Nr.</TableHead>
                      <TableHead>Eingang</TableHead>
                      <TableHead>Teil</TableHead>
                      <TableHead>Lieferant</TableHead>
                      <TableHead>Charge / Los</TableHead>
                      <TableHead>Seriennummern</TableHead>
                      <TableHead className="text-right">Menge</TableHead>
                      <TableHead>Prüfung</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receiptRows.map(r => {
                      const part = partMap[r.part_id];
                      const sup = supMap[r.supplier_id];
                      const serials = listOf(r.serial_numbers);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.receipt_number || '—'}</TableCell>
                          <TableCell>{r.received_at ? new Date(r.received_at).toLocaleDateString('de-DE') : '—'}</TableCell>
                          <TableCell>
                            <div>{part?.name || '—'}</div>
                            <div className="font-mono text-xs text-muted-foreground">{part?.part_number || ''}</div>
                          </TableCell>
                          <TableCell>{sup?.name || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {[r.batch_number, r.lot_number].filter(Boolean).join(' / ') || '—'}
                          </TableCell>
                          <TableCell className="max-w-[240px]">
                            {serials.length === 0 ? '—' : (
                              <div className="flex flex-wrap gap-1">
                                {serials.slice(0, 6).map((s, i) => (
                                  <Badge key={i} variant="outline" className="font-mono text-[10px]">{s}</Badge>
                                ))}
                                {serials.length > 6 && (
                                  <span className="text-xs text-muted-foreground">+{serials.length - 6}</span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{r.quantity ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={toneClass(statusTone(r.inspection_result))}>
                              {plmLabel(r.inspection_result)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="border-b p-4 text-sm font-medium">
                Produktionsaufträge <span className="text-muted-foreground">({orderRows.length})</span>
              </div>
              {orderRows.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Keine Treffer in den Produktionsaufträgen.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Auftrag</TableHead>
                      <TableHead>Gerät</TableHead>
                      <TableHead>Charge</TableHead>
                      <TableHead>Seriennummern</TableHead>
                      <TableHead className="text-right">Menge</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderRows.map(o => {
                      const dev = devMap[o.device_id];
                      const serials = listOf(o.serial_numbers);
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-xs">{o.order_number || '—'}</TableCell>
                          <TableCell>
                            <div>{dev?.name || '—'}</div>
                            <div className="font-mono text-xs text-muted-foreground">{dev?.article_number || ''}</div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{o.batch_number || '—'}</TableCell>
                          <TableCell className="max-w-[240px]">
                            {serials.length === 0 ? '—' : (
                              <div className="flex flex-wrap gap-1">
                                {serials.slice(0, 6).map((s, i) => (
                                  <Badge key={i} variant="outline" className="font-mono text-[10px]">{s}</Badge>
                                ))}
                                {serials.length > 6 && (
                                  <span className="text-xs text-muted-foreground">+{serials.length - 6}</span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{o.quantity ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={toneClass(statusTone(o.status))}>
                              {plmLabel(o.status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
