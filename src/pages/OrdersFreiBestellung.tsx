import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Search, Loader2, Inbox, Factory, Warehouse } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { PageSizeSelector, usePagination, PaginationControls } from '@/components/PageSizeSelector';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getStatus(notes: string | null | undefined): string {
  const m = /\[Status:\s*([^\]]+)\]/.exec(notes ?? '');
  return (m?.[1] ?? 'Bestand').trim();
}

type FreeDevice = {
  id: string;
  serial_number: string;
  model_name: string;
  notes: string | null;
};

type OrderItem = { order_id: string; item_name: string | null; description: string | null; sku: string | null };

function normalize(s: string | null | undefined) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function findMatches(items: OrderItem[], devices: FreeDevice[]): FreeDevice[] {
  if (!items.length || !devices.length) return [];
  const haystack = items.map(i => normalize(`${i.item_name || ''} ${i.description || ''} ${i.sku || ''}`)).join(' | ');
  const seen = new Set<string>();
  const out: FreeDevice[] = [];
  for (const d of devices) {
    const m = normalize(d.model_name);
    if (!m) continue;
    if (haystack.includes(m) && !seen.has(d.id)) {
      seen.add(d.id);
      out.push(d);
    }
  }
  return out;
}

export default function OrdersFreiBestellung() {
  const [orders, setOrders] = useState<any[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItem[]>>({});
  const [freeBestand, setFreeBestand] = useState<FreeDevice[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const [reserveOrder, setReserveOrder] = useState<any | null>(null);
  const [reserveDeviceId, setReserveDeviceId] = useState<string>('');
  const [reserving, setReserving] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('orders')
      .select('id, order_number, order_status, order_date, expected_shipment_date, total_amount, currency, deposit_ok, deposit_ok_by, deposit_ok_at, deposit_amount, customers(company_name, contact_name)')
      .eq('deposit_ok', true)
      .not('deposit_ok_by', 'is', null)
      .neq('deposit_ok_by', '')
      .order('deposit_ok_at', { ascending: false })
      .limit(500);
    if (err) setError(err.message);

    // Exclude orders that already have a production order OR a reserved lager device
    const [{ data: existing }, { data: reservedDevs }, { data: freeDevs }] = await Promise.all([
      supabase.from('production_orders').select('order_id'),
      supabase.from('lager_devices').select('reserved_order_id').not('reserved_order_id', 'is', null),
      supabase.from('lager_devices').select('id, serial_number, model_name, notes').is('reserved_order_id', null),
    ]);
    const usedOrderIds = new Set([
      ...((existing ?? []).map((p: any) => p.order_id)),
      ...((reservedDevs ?? []).map((p: any) => p.reserved_order_id)),
    ]);
    const filteredOrders = (data ?? []).filter((o: any) => !usedOrderIds.has(o.id));
    setOrders(filteredOrders);

    // Only Bestand devices
    const bestandOnly = ((freeDevs as FreeDevice[]) ?? []).filter(d => getStatus(d.notes) === 'Bestand');
    setFreeBestand(bestandOnly);

    // Load order items for visible orders
    if (filteredOrders.length > 0) {
      const ids = filteredOrders.map((o: any) => o.id);
      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, item_name, description, sku')
        .in('order_id', ids);
      const map: Record<string, OrderItem[]> = {};
      for (const it of (items as OrderItem[]) ?? []) {
        (map[it.order_id] ??= []).push(it);
      }
      setItemsByOrder(map);
    } else {
      setItemsByOrder({});
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const matchesByOrder = useMemo(() => {
    const m: Record<string, FreeDevice[]> = {};
    for (const o of orders) {
      m[o.id] = findMatches(itemsByOrder[o.id] || [], freeBestand);
    }
    return m;
  }, [orders, itemsByOrder, freeBestand]);

  const filtered = useMemo(() => orders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(q) ||
      o.customers?.company_name?.toLowerCase().includes(q) ||
      o.customers?.contact_name?.toLowerCase().includes(q) ||
      o.deposit_ok_by?.toLowerCase().includes(q)
    );
  }), [orders, search]);

  const { pageSize, setPageSize, page, setPage, totalPages, paged, total } = usePagination(filtered, 20);

  const openReserve = (o: any) => {
    const m = matchesByOrder[o.id] || [];
    setReserveOrder(o);
    setReserveDeviceId(m[0]?.id || '');
  };

  const confirmReserve = async () => {
    if (!reserveOrder || !reserveDeviceId) return;
    setReserving(true);
    const { error: upErr } = await supabase
      .from('lager_devices')
      .update({ reserved_order_id: reserveOrder.id })
      .eq('id', reserveDeviceId);
    setReserving(false);
    if (upErr) {
      toast.error('Reservierung fehlgeschlagen: ' + upErr.message);
      return;
    }
    toast.success('Gerät aus Lagerbestand reserviert — keine Bestellung nötig');
    setReserveOrder(null);
    setReserveDeviceId('');
    reload();
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-green-500 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
            Bestellung möglich
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} Aufträge mit bestätigter Anzahlung — bereit zur Bestellung
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suche nach Auftrag, Kunde, Mitarbeiter..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
        </div>
        <PageSizeSelector value={pageSize} onChange={setPageSize} />
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Auftragsnr.</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Artikel</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Freigabe am</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Anzahlung</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Lieferdatum</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Lagerbestand</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">Keine Aufträge mit Anzahlungsbestätigung gefunden.</p>
                </td></tr>
              ) : (
                paged.map(o => {
                  const matches = matchesByOrder[o.id] || [];
                  const inStock = matches.length > 0;
                  return (
                    <tr key={o.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground cursor-pointer" onClick={() => navigate(`/auftraege/${o.id}`)}>{o.order_number}</td>
                      <td className="px-4 py-3 text-muted-foreground">{o.customers?.company_name || o.customers?.contact_name || '—'}</td>
                      <td className="px-4 py-3 text-foreground">
                        {(() => {
                          const items = itemsByOrder[o.id] || [];
                          const names = items.map(i => i.item_name).filter(Boolean) as string[];
                          if (names.length === 0) return <span className="text-muted-foreground">—</span>;
                          return (
                            <HoverCard openDelay={100} closeDelay={50}>
                              <HoverCardTrigger asChild>
                                <span className="line-clamp-2 cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2">
                                  {names.join(', ')}
                                </span>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80 max-h-80 overflow-auto">
                                <div className="text-xs font-semibold text-muted-foreground mb-2">
                                  Artikel ({items.length})
                                </div>
                                <ul className="space-y-2 text-sm">
                                  {items.map((it, idx) => (
                                    <li key={idx} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                      <div className="font-medium text-foreground">{it.item_name || '—'}</div>
                                      {it.sku && <div className="text-xs text-muted-foreground font-mono">SKU: {it.sku}</div>}
                                      {it.description && <div className="text-xs text-muted-foreground mt-0.5">{it.description}</div>}
                                    </li>
                                  ))}
                                </ul>
                              </HoverCardContent>
                            </HoverCard>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(o.deposit_ok_at)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {o.deposit_amount != null ? `${Number(o.deposit_amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${o.currency || '€'}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(o.expected_shipment_date)}</td>
                      <td className="px-4 py-3">
                        {inStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-xs font-medium">
                            <Warehouse className="w-3.5 h-3.5" />
                            {matches.length}× vorhanden
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={o.order_status} /></td>
                      <td className="px-4 py-3 text-right">
                        {inStock ? (
                          <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openReserve(o)}>
                            <Warehouse className="w-4 h-4 mr-1" /> Aus Lager reservieren
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => navigate(`/order/neu?order_id=${o.id}`)}>
                            <Factory className="w-4 h-4 mr-1" /> Bestellung
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} total={total} />

      <Dialog open={!!reserveOrder} onOpenChange={(v) => { if (!v) { setReserveOrder(null); setReserveDeviceId(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-emerald-500" />
              Aus Lagerbestand reservieren
            </DialogTitle>
            <DialogDescription>
              Für Auftrag <span className="font-medium text-foreground">{reserveOrder?.order_number}</span> wurde ein passendes Gerät im Lagerbestand gefunden. Wird ein Gerät reserviert, ist <span className="font-medium">keine Bestellung</span> mehr nötig.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {(matchesByOrder[reserveOrder?.id] || []).map(d => (
              <label key={d.id} className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer ${reserveDeviceId === d.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-border'}`}>
                <input
                  type="radio"
                  name="lagerdevice"
                  checked={reserveDeviceId === d.id}
                  onChange={() => setReserveDeviceId(d.id)}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{d.model_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">SN: {d.serial_number}</div>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReserveOrder(null); setReserveDeviceId(''); }} disabled={reserving}>
              Abbrechen
            </Button>
            <Button onClick={confirmReserve} disabled={!reserveDeviceId || reserving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {reserving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Reservierung bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
