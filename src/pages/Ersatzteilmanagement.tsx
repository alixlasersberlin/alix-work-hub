import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Boxes, AlertTriangle, PackageCheck, ShoppingCart, TrendingDown, Loader2, RefreshCw, Truck } from 'lucide-react';

type StockRow = {
  id: string;
  name: string | null;
  sku: string | null;
  category_name: string | null;
  manufacturer: string | null;
  storage_location: string | null;
  ek: number | null;
  vk: number | null;
  stock_on_hand: number;
  stock_reserved: number;
  stock_available: number;
  stock_on_order: number;
  min_stock: number | null;
  reorder_level: number | null;
  primary_supplier_name: string | null;
  lead_time_days: number | null;
  serial_required: boolean | null;
  is_spare_part: boolean | null;
  stock_status: 'kritisch' | 'meldebestand' | 'ok';
};

const STATUS_BADGE: Record<string, string> = {
  kritisch: 'bg-destructive/15 text-destructive border-destructive/30',
  meldebestand: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  ok: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
};

export default function Ersatzteilmanagement() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [consumption, setConsumption] = useState<any[]>([]);
  const [technicianStock, setTechnicianStock] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [onlySpare, setOnlySpare] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, o, r, c, t] = await Promise.all([
      supabase.from('spare_part_stock_overview' as any).select('*').order('stock_status', { ascending: true }).limit(2000),
      supabase.from('spare_part_orders' as any).select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('goods_receipts' as any).select('*').order('received_at', { ascending: false }).limit(100),
      supabase.from('spare_part_consumption' as any).select('*').order('consumed_at', { ascending: false }).limit(200),
      supabase.from('technician_stock' as any).select('*').order('technician_id'),
    ]);
    if (s.error) toast.error('Lagerübersicht: ' + s.error.message);
    setRows((s.data as any) || []);
    setOrders((o.data as any) || []);
    setReceipts((r.data as any) || []);
    setConsumption((c.data as any) || []);
    setTechnicianStock((t.data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (onlySpare && !r.is_spare_part) return false;
      if (!q.trim()) return true;
      const s = q.toLowerCase();
      return (
        (r.name || '').toLowerCase().includes(s) ||
        (r.sku || '').toLowerCase().includes(s) ||
        (r.manufacturer || '').toLowerCase().includes(s) ||
        (r.category_name || '').toLowerCase().includes(s) ||
        (r.storage_location || '').toLowerCase().includes(s)
      );
    });
  }, [rows, onlySpare, q]);

  const kpis = useMemo(() => {
    const critical = filtered.filter(r => r.stock_status === 'kritisch').length;
    const reorder = filtered.filter(r => r.stock_status === 'meldebestand').length;
    const openOrders = orders.filter(o => !['Erhalten', 'Storniert'].includes(o.status)).length;
    const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthConsumption = consumption.filter(c => new Date(c.consumed_at) >= monthAgo)
      .reduce((sum, c) => sum + Number(c.quantity || 0), 0);
    const receiptsThisMonth = receipts.filter(r => new Date(r.received_at) >= monthAgo).length;
    return { critical, reorder, openOrders, monthConsumption, receiptsThisMonth };
  }, [filtered, orders, consumption, receipts]);

  const topParts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number }>();
    consumption.forEach(c => {
      const key = c.item_id || c.sku || c.item_name;
      const prev = map.get(key) || { name: c.item_name || c.sku || '—', qty: 0 };
      prev.qty += Number(c.quantity || 0);
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [consumption]);

  const createOrderFromRow = async (row: StockRow) => {
    const target = Math.max((row.reorder_level || 0) * 2, (row.min_stock || 0) * 2, 1);
    const qty = Math.max(target - row.stock_on_hand, 1);
    const { data: order, error } = await (supabase.from('spare_part_orders' as any) as any).insert({
      supplier_name: row.primary_supplier_name,
      status: 'Entwurf',
      notes: `Automatischer Bestellvorschlag für ${row.name || row.sku}`,
    }).select().single();
    if (error || !order) return toast.error('Bestellung: ' + (error?.message || 'unbekannt'));
    const { error: e2 } = await (supabase.from('spare_part_order_items' as any) as any).insert({
      order_id: (order as any).id,
      item_id: row.id,
      item_name: row.name || row.sku || 'Artikel',
      sku: row.sku,
      quantity: qty,
      unit_price: row.ek,
    });
    if (e2) return toast.error('Position: ' + e2.message);
    await (supabase.from('zoho_items' as any) as any).update({ stock_on_order: (row.stock_on_order || 0) + qty }).eq('id', row.id);
    toast.success(`Bestellung ${(order as any).order_number} angelegt (${qty} × ${row.name})`);
    load();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Boxes className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Ersatzteilmanagement</h1>
          <p className="text-muted-foreground text-sm">Lager, Bestellvorschläge, Wareneingang, Verbrauch und Technikerlager.</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Aktualisieren
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Kritisch</div>
          <div className="text-2xl font-bold text-destructive">{kpis.critical}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Meldebestand</div>
          <div className="text-2xl font-bold text-amber-600">{kpis.reorder}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> Offene Bestellungen</div>
          <div className="text-2xl font-bold">{kpis.openOrders}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><PackageCheck className="w-3 h-3" /> Wareneingänge (30 T.)</div>
          <div className="text-2xl font-bold">{kpis.receiptsThisMonth}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Verbrauch (30 T.)</div>
          <div className="text-2xl font-bold">{kpis.monthConsumption}</div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Lagerbestand</TabsTrigger>
          <TabsTrigger value="suggestions">Bestellvorschläge</TabsTrigger>
          <TabsTrigger value="orders">Bestellungen</TabsTrigger>
          <TabsTrigger value="receipts">Wareneingang</TabsTrigger>
          <TabsTrigger value="consumption">Verbrauch</TabsTrigger>
          <TabsTrigger value="technician">Technikerlager</TabsTrigger>
          <TabsTrigger value="top">Top-Ersatzteile</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <div className="flex gap-2 items-center">
            <Input placeholder="Suche Name, SKU, Lagerort…" value={q} onChange={e => setQ(e.target.value)} className="max-w-md" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlySpare} onChange={e => setOnlySpare(e.target.checked)} />
              Nur Ersatzteile
            </label>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artikel</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Lagerort</TableHead>
                  <TableHead className="text-right">Bestand</TableHead>
                  <TableHead className="text-right">Reserviert</TableHead>
                  <TableHead className="text-right">Verfügbar</TableHead>
                  <TableHead className="text-right">Bestellt</TableHead>
                  <TableHead className="text-right">Meldebestand</TableHead>
                  <TableHead className="text-right">Mindestbestand</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">Lädt…</TableCell></TableRow>}
                {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">Keine Artikel</TableCell></TableRow>}
                {filtered.slice(0, 500).map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div>{r.name}</div>
                      {r.manufacturer && <div className="text-xs text-muted-foreground">{r.manufacturer}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.sku || '—'}</TableCell>
                    <TableCell className="text-xs">{r.storage_location || '—'}</TableCell>
                    <TableCell className="text-right">{r.stock_on_hand}</TableCell>
                    <TableCell className="text-right">{r.stock_reserved}</TableCell>
                    <TableCell className="text-right font-medium">{r.stock_available}</TableCell>
                    <TableCell className="text-right">{r.stock_on_order}</TableCell>
                    <TableCell className="text-right">{r.reorder_level ?? '—'}</TableCell>
                    <TableCell className="text-right">{r.min_stock ?? '—'}</TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_BADGE[r.stock_status]}>{r.stock_status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="suggestions">
          <Card><CardHeader><CardTitle>Automatische Bestellvorschläge</CardTitle></CardHeader><CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Artikel</TableHead><TableHead>SKU</TableHead><TableHead>Bestand</TableHead>
                <TableHead>Meldebestand</TableHead><TableHead>Lieferant</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.filter(r => r.stock_status !== 'ok').slice(0, 200).map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.sku || '—'}</TableCell>
                    <TableCell>{r.stock_on_hand}</TableCell>
                    <TableCell>{r.reorder_level ?? r.min_stock ?? '—'}</TableCell>
                    <TableCell>{r.primary_supplier_name || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => createOrderFromRow(r)}>Bestellung anlegen</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.filter(r => r.stock_status !== 'ok').length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Keine Vorschläge.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Nr.</TableHead><TableHead>Lieferant</TableHead><TableHead>Status</TableHead>
                <TableHead>Erwartet</TableHead><TableHead>Erstellt</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {orders.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.order_number || o.id.slice(0, 8)}</TableCell>
                    <TableCell>{o.supplier_name || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                    <TableCell>{o.expected_at || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString('de-DE')}</TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Keine Bestellungen.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="receipts">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Datum</TableHead><TableHead>Artikel</TableHead><TableHead>SKU</TableHead>
                <TableHead className="text-right">Menge</TableHead><TableHead>Lieferant</TableHead><TableHead>Lieferschein</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {receipts.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.received_at).toLocaleString('de-DE')}</TableCell>
                    <TableCell className="font-medium">{r.item_name || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{r.sku || '—'}</TableCell>
                    <TableCell className="text-right">{r.quantity}</TableCell>
                    <TableCell>{r.supplier || '—'}</TableCell>
                    <TableCell>{r.delivery_note || '—'}</TableCell>
                  </TableRow>
                ))}
                {receipts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Noch keine Wareneingänge.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="consumption">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Datum</TableHead><TableHead>Artikel</TableHead><TableHead>Quelle</TableHead>
                <TableHead>Seriennr.</TableHead><TableHead>Kunde</TableHead><TableHead className="text-right">Menge</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {consumption.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{new Date(c.consumed_at).toLocaleString('de-DE')}</TableCell>
                    <TableCell className="font-medium">{c.item_name}</TableCell>
                    <TableCell><Badge variant="outline">{c.source_type}</Badge>{c.warranty_case && <Badge variant="outline" className="ml-1">Garantie</Badge>}</TableCell>
                    <TableCell className="font-mono text-xs">{c.device_serial || '—'}</TableCell>
                    <TableCell className="text-xs">{c.customer_name || '—'}</TableCell>
                    <TableCell className="text-right">{c.quantity}</TableCell>
                  </TableRow>
                ))}
                {consumption.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Keine Verbrauchsbuchungen.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="technician">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Truck className="w-4 h-4" /> Technikerlager / Fahrzeuglager</CardTitle></CardHeader><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Techniker</TableHead><TableHead>Fahrzeug</TableHead><TableHead>Artikel</TableHead>
                <TableHead>SKU</TableHead><TableHead className="text-right">Bestand</TableHead><TableHead className="text-right">Min.</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {technicianStock.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.technician_id?.slice(0, 8)}</TableCell>
                    <TableCell>{t.vehicle_label || '—'}</TableCell>
                    <TableCell className="font-medium">{t.item_name}</TableCell>
                    <TableCell className="font-mono text-xs">{t.sku || '—'}</TableCell>
                    <TableCell className="text-right">{t.quantity}</TableCell>
                    <TableCell className="text-right">{t.min_quantity ?? '—'}</TableCell>
                  </TableRow>
                ))}
                {technicianStock.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Noch keine Technikerlager erfasst.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="top">
          <Card><CardHeader><CardTitle>Top-Ersatzteile (Verbrauch)</CardTitle></CardHeader><CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Artikel</TableHead><TableHead className="text-right">Menge</TableHead></TableRow></TableHeader>
              <TableBody>
                {topParts.map((p, i) => (
                  <TableRow key={i}><TableCell>{p.name}</TableCell><TableCell className="text-right font-bold">{p.qty}</TableCell></TableRow>
                ))}
                {topParts.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">Keine Daten.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
