import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Pause, Search, Loader2, Inbox } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import OrderStatsBar from '@/components/OrderStatsBar';
import { PageSizeSelector, usePagination, PaginationControls } from '@/components/PageSizeSelector';
import { ViewToggle } from '@/components/ViewToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { OrderCard, OrderCardGrid } from '@/components/OrderCard';
import { useAtOnly } from '@/hooks/useAtOnly';

interface HoldOrder {
  id: string;
  order_number: string;
  order_status: string | null;
  order_date: string | null;
  expected_shipment_date: string | null;
  total_amount: number | null;
  currency: string | null;
  source_system: string;
  shipping_address: any;
  billing_address: any;
  customers: {
    company_name: string | null;
    contact_name: string | null;
    shipping_address: any;
    billing_address: any;
  } | null;
}

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('de-DE');
}

function resolveCity(order: HoldOrder): string {
  const hasAddr = (a: any) => a && (a.city || a.address || a.street);
  const addr =
    (hasAddr(order.shipping_address) ? order.shipping_address : null) ||
    (hasAddr(order.customers?.shipping_address) ? order.customers?.shipping_address : null) ||
    (hasAddr(order.billing_address) ? order.billing_address : null) ||
    (hasAddr(order.customers?.billing_address) ? order.customers?.billing_address : null);
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return addr.city || addr.state || '';
}

export default function HoldList() {
  const [orders, setOrders] = useState<HoldOrder[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useViewMode();
  const atOnly = useAtOnly();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      let qb = supabase
        .from('orders')
        .select('id, order_number, order_status, order_date, expected_shipment_date, total_amount, currency, source_system, shipping_address, billing_address, customers(company_name, contact_name, shipping_address, billing_address)')
        .in('order_status', ['hold', 'Hold', 'HOLD', 'on_hold', 'On Hold'])
        .order('order_date', { ascending: false })
        .limit(500);
      if (atOnly) qb = qb.eq('source_system', 'zoho_eu_2');
      const { data, error: err } = await qb;
      if (err) setError(err.message);
      setOrders((data ?? []) as any as HoldOrder[]);
      setLoading(false);
    }
    load();
  }, [atOnly]);

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    if (!search) return true;
    return o.order_number?.toLowerCase().includes(q) ||
      o.customers?.company_name?.toLowerCase().includes(q) ||
      o.customers?.contact_name?.toLowerCase().includes(q) ||
      resolveCity(o)?.toLowerCase().includes(q);
  });

  const { pageSize, setPageSize, page, setPage, totalPages, paged, total } = usePagination(filtered, 20);

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Pause className="w-6 h-6 text-amber-500" />
          Hold
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filtered.length} Aufträge mit Status „Hold"
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Auftrag, Kunde, Ort..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>
        <PageSizeSelector value={pageSize} onChange={setPageSize} />
        <div className="ml-auto"><ViewToggle value={viewMode} onChange={setViewMode} /></div>
      </div>

      <OrderStatsBar orders={orders} filteredCount={filtered.length} label="Hold Aufträge" />

      {error && <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">{error}</div>}

      {viewMode === 'cards' ? (
        loading ? (
          <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-muted-foreground">Keine Hold-Aufträge gefunden.</p>
          </div>
        ) : (
          <OrderCardGrid>
            {paged.map(o => (
              <OrderCard key={o.id} order={o} onClick={() => navigate(`/auftraege/${o.id}`)} />
            ))}
          </OrderCardGrid>
        )
      ) : (
        <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium w-12">#</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Auftragsdatum</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Auftrag</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Ort</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Betrag</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center">
                    <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-muted-foreground">Keine Hold-Aufträge gefunden.</p>
                  </td></tr>
                ) : (
                  paged.map((o, idx) => {
                    const city = resolveCity(o);
                    const name = o.customers?.company_name || o.customers?.contact_name || '—';
                    return (
                      <tr key={o.id} className="hover:bg-secondary/30 transition-colors cursor-pointer bg-amber-500/5"
                        onClick={() => navigate(`/auftraege/${o.id}`)}>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                        <td className="px-4 py-3 text-foreground">{formatDate(o.order_date)}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{o.order_number}</td>
                        <td className="px-4 py-3 text-muted-foreground">{name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{city || '—'}</td>
                        <td className="px-4 py-3 text-foreground">
                          {o.total_amount != null ? Number(o.total_amount).toLocaleString('de-DE', { style: 'currency', currency: o.currency || 'EUR' }) : '—'}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={o.order_status || 'Hold'} /></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} total={total} />
    </div>
  );
}
