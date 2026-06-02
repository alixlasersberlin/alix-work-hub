import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PackageCheck, Search, Loader2, Inbox, ArrowUpDown, Pencil, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/hooks/useAuth';
import OrderItemsEditDialog from '@/components/OrderItemsEditDialog';
import OrderStatsBar from '@/components/OrderStatsBar';
import { PageSizeSelector, usePagination, PaginationControls } from '@/components/PageSizeSelector';
import { toast } from 'sonner';
import { createRestbestellungMarker, fetchPendingRestbestellungOrderIds } from '@/lib/restbestellung';
import { useAtOnly } from '@/hooks/useAtOnly';

type SortField = 'order_number' | 'expected_shipment_date' | 'total_amount';
type SortDir = 'asc' | 'desc';

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function PartialDeliveryList() {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('order_number');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isAdmin, hasRole } = useAuth();
  const canManageRest = isAdmin || hasRole('Order');
  const [editOrder, setEditOrder] = useState<{ id: string; order_number: string | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingRest, setPendingRest] = useState<Set<string>>(new Set());
  const atOnly = useAtOnly();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      let qb = supabase
        .from('orders')
        .select('id, order_number, order_status, order_date, expected_shipment_date, total_amount, currency, source_system, customers(company_name, contact_name)')
        .eq('order_status', 'teilgeliefert')
        .order(sortField, { ascending: sortDir === 'asc' })
        .limit(500);
      if (atOnly) qb = qb.eq('source_system', 'zoho_eu_2');
      const [{ data, error: err }, pending] = await Promise.all([
        qb,
        fetchPendingRestbestellungOrderIds(),
      ]);
      if (err) setError(err.message);
      setOrders(data ?? []);
      setPendingRest(pending);
      setLoading(false);
    }
    load();
  }, [sortField, sortDir, reloadKey, atOnly]);

  const handleCreateRest = async (orderId: string, orderNumber: string | null) => {
    const { error } = await createRestbestellungMarker(orderId);
    if (error) { toast.error('Fehler: ' + error); return; }
    toast.success(`Auftrag ${orderNumber ?? ''} in „Bestellung möglich" übernommen`);
    setReloadKey(k => k + 1);
  };

  const filtered = useMemo(() => orders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(q) ||
      o.customers?.company_name?.toLowerCase().includes(q) ||
      o.customers?.contact_name?.toLowerCase().includes(q)
    );
  }), [orders, search]);

  const { pageSize, setPageSize, page, setPage, totalPages, paged, total } = usePagination(filtered, 20);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="text-left px-4 py-3 text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <PackageCheck className="w-6 h-6 text-primary" />
            Teilgeliefert
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} Aufträge mit Status „teilgeliefert"</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suche nach Auftrag, Kunde..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
        </div>
        <PageSizeSelector value={pageSize} onChange={setPageSize} />
      </div>

      <OrderStatsBar orders={orders} filteredCount={filtered.length} label="Aufträge teilgeliefert" />

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <SortHeader field="order_number" label="Auftragsnr." />
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kontakt</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Auftragsdatum</th>
                <SortHeader field="expected_shipment_date" label="Lieferdatum" />
                <SortHeader field="total_amount" label="Betrag" />
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                {canManageRest && <th className="text-right px-4 py-3 text-muted-foreground font-medium">Aktion</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={canManageRest ? 8 : 7} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={canManageRest ? 8 : 7} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">Keine Aufträge mit Status „teilgeliefert" gefunden.</p>
                </td></tr>
              ) : (
                paged.map(o => (
                  <tr key={o.id} className="hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => navigate(`/auftraege/${o.id}`)}>
                    <td className="px-4 py-3 font-medium text-foreground">{o.order_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.customers?.company_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.customers?.contact_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.order_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.expected_shipment_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.total_amount != null ? `${o.total_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${o.currency || '€'}` : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={o.order_status} /></td>
                    {canManageRest && (
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {pendingRest.has(o.id) ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              In „Bestellung möglich"
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                              onClick={() => handleCreateRest(o.id, o.order_number)}
                            >
                              <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                              Restbestellung
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="gold-gradient text-primary-foreground"
                            onClick={() => setEditOrder({ id: o.id, order_number: o.order_number })}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            ÄNDERUNG
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} total={total} />

      {editOrder && (
        <OrderItemsEditDialog
          orderId={editOrder.id}
          orderNumber={editOrder.order_number}
          open={!!editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={() => setReloadKey(k => k + 1)}
        />
      )}
    </div>
  );
}
