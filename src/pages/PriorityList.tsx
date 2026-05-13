import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListOrdered, Search, Loader2, Inbox, ArrowUpDown, Package, Car } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { useDrivingTimes } from '@/hooks/useDrivingTimes';
import { DrivingTimeCell } from '@/components/DrivingTimeCell';
import OrderStatsBar from '@/components/OrderStatsBar';
import { PageSizeSelector, usePagination, PaginationControls } from '@/components/PageSizeSelector';
import { ViewToggle } from '@/components/ViewToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { OrderCard, OrderCardGrid } from '@/components/OrderCard';
import { ALIX_MODEL_GROUPS } from '@/lib/alix-models';

type SortField = 'expected_shipment_date' | 'order_number' | 'total_amount';
type SortDir = 'asc' | 'desc';

interface PrioOrder {
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
  order_items: { item_name: string | null; description: string | null; sku: string | null }[] | null;
}

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getDaysUntil(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(date);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function resolveCity(order: PrioOrder): string {
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

function getPriorityColor(days: number | null): string {
  if (days === null) return 'text-muted-foreground';
  if (days < 0) return 'text-destructive';
  if (days <= 7) return 'text-[hsl(var(--warning))]';
  if (days <= 21) return 'text-primary';
  return 'text-[hsl(var(--success))]';
}

function getPriorityLabel(days: number | null): string {
  if (days === null) return '—';
  if (days < 0) return `${Math.abs(days)} Tage überfällig`;
  if (days === 0) return 'Heute';
  if (days === 1) return 'Morgen';
  return `in ${days} Tagen`;
}

export default function PriorityList() {
  const [orders, setOrders] = useState<PrioOrder[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('expected_shipment_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { drivingTimes, loading: drivingLoading, requestedIds, fetchDrivingTimes, retryFailed } = useDrivingTimes();
  const [viewMode, setViewMode] = useViewMode();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('orders')
        .select('id, order_number, order_status, order_date, expected_shipment_date, total_amount, currency, source_system, shipping_address, billing_address, customers(company_name, contact_name, shipping_address, billing_address), order_items(item_name, description, sku)')
        .not('expected_shipment_date', 'is', null)
        .in('order_status', ['overdue', 'Overdue', 'invoiced', 'Invoiced', 'open', 'Open', 'offen', 'Offen', 'approved', 'Approved'])
        .order(sortField, { ascending: sortDir === 'asc' })
        .limit(500);
      if (err) setError(err.message);
      const loaded = (data ?? []) as any as PrioOrder[];
      setOrders(loaded);
      setLoading(false);
    }
    load();
  }, [sortField, sortDir]);

  const statuses = [...new Set(orders.map(o => o.order_status).filter(Boolean))];

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const modelMatch = o.order_items?.some(it =>
      it.item_name?.toLowerCase().includes(q) ||
      it.description?.toLowerCase().includes(q) ||
      it.sku?.toLowerCase().includes(q)
    );
    const matchSearch = !search ||
      o.order_number?.toLowerCase().includes(q) ||
      o.customers?.company_name?.toLowerCase().includes(q) ||
      o.customers?.contact_name?.toLowerCase().includes(q) ||
      resolveCity(o)?.toLowerCase().includes(q) ||
      modelMatch;
    const matchStatus = statusFilter === 'all' || o.order_status === statusFilter;
    const matchModel = modelFilter === 'all' || o.order_items?.some(it => {
      const m = modelFilter.toLowerCase();
      return it.item_name?.toLowerCase().includes(m) ||
        it.description?.toLowerCase().includes(m) ||
        it.sku?.toLowerCase().includes(m);
    });
    return matchSearch && matchStatus && matchModel;
  });

  const { pageSize, setPageSize, page, setPage, totalPages, paged, total } = usePagination(filtered, 20);

  // Only fetch driving times for currently visible (paged) orders to avoid edge function timeout
  useEffect(() => {
    if (paged.length > 0) fetchDrivingTimes(paged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filtered.length]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortHeader = ({ field, label, className = '' }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`text-left px-4 py-3 text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors ${className}`}
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field && <ArrowUpDown className="w-3 h-3 text-primary" />}
      </span>
    </th>
  );

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <ListOrdered className="w-6 h-6 text-primary" />
          Prio-Liste
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filtered.length} Aufträge sortiert nach Versanddatum
        </p>
      </div>

      {/* Filters */}
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 bg-secondary border-border">
            <SelectValue placeholder="Status filtern" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s!}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <PageSizeSelector value={pageSize} onChange={setPageSize} />
        {(() => {
          const failed = paged.filter((o: any) => drivingTimes[o.id] === null);
          if (failed.length === 0) return null;
          return (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              disabled={drivingLoading}
              onClick={() => retryFailed(failed)}
              title="Fehlgeschlagene Fahrzeiten erneut berechnen"
            >
              {drivingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Car className="w-3.5 h-3.5" />}
              Fahrzeiten erneut ({failed.length})
            </Button>
          );
        })()}
        <div className="ml-auto"><ViewToggle value={viewMode} onChange={setViewMode} /></div>
      </div>

      <OrderStatsBar orders={orders} filteredCount={filtered.length} label="Prio-Liste Aufträge" />

      {error && <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">{error}</div>}

      {/* Table */}
      {viewMode === 'cards' ? (
        loading ? (
          <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-muted-foreground">Keine Aufträge gefunden.</p>
          </div>
        ) : (
          <OrderCardGrid>
            {paged.map(o => (
              <OrderCard
                key={o.id}
                order={o}
                onClick={() => navigate(`/auftraege/${o.id}`)}
                footer={<DrivingTimeCell value={drivingTimes[o.id]} requested={requestedIds.has(o.id)} loading={drivingLoading} />}
              />
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
                <SortHeader field="expected_shipment_date" label="Versanddatum" />
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Verbleibend</th>
                <SortHeader field="order_number" label="Auftrag" />
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Ort</th>
                <SortHeader field="total_amount" label="Betrag" />
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                  <span className="inline-flex items-center gap-1"><Car className="w-3.5 h-3.5" /> Fahrzeit</span>
                </th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">Keine Aufträge gefunden.</p>
                </td></tr>
              ) : (
                paged.map((o, idx) => {
                  const days = getDaysUntil(o.expected_shipment_date);
                  const city = resolveCity(o);
                  const name = o.customers?.company_name || o.customers?.contact_name || '—';
                  return (
                    <tr
                      key={o.id}
                      className="hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/auftraege/${o.id}`)}
                    >
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-muted-foreground" />
                          {formatDate(o.expected_shipment_date)}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-semibold text-xs ${getPriorityColor(days)}`}>
                        {getPriorityLabel(days)}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{o.order_number}</td>
                      <td className="px-4 py-3 text-muted-foreground">{name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{city || '—'}</td>
                      <td className="px-4 py-3 text-foreground">
                        {o.total_amount != null ? Number(o.total_amount).toLocaleString('de-DE', { style: 'currency', currency: o.currency || 'EUR' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <DrivingTimeCell
                          value={drivingTimes[o.id]}
                          requested={requestedIds.has(o.id)}
                          loading={drivingLoading}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.order_status || 'offen'} />
                      </td>
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
