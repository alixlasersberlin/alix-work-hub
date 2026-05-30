import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ClipboardList, ArrowUpDown, Loader2, Inbox, Pencil, CalendarClock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import OrderEditDialog from '@/components/OrderEditDialog';
import OrderDeferDialog from '@/components/OrderDeferDialog';
import OrderItemsEditDialog from '@/components/OrderItemsEditDialog';
import { Package } from 'lucide-react';
import OrderStatsBar from '@/components/OrderStatsBar';
import { VipBadge } from '@/components/VipBadge';
import { isOrderVip, vipFirst } from '@/lib/vip';
import { ALIX_MODEL_GROUPS } from '@/lib/alix-models';
import { withAt } from '@/lib/atSuffix';

type SortField = 'order_number' | 'order_date' | 'total_amount' | 'created_at';
type SortDir = 'asc' | 'desc';
type PageSize = 20 | 30 | 50 | 'all';

export default function OrdersAt() {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('order_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [deferOrder, setDeferOrder] = useState<any>(null);
  const [itemsOrder, setItemsOrder] = useState<any>(null);
  const navigate = useNavigate();
  const { isAdmin, hasRole } = useAuth();

  const canWrite = isAdmin || hasRole('Auftragsverwaltung');
  const canEditItems = hasRole('Super Admin');
  const canSeeApproval = hasRole('Super Admin') || hasRole('Admin');

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('orders')
      .select('*, customers(company_name, contact_name, shipping_address, billing_address, is_vip), order_items(id, item_name, description, sku, quantity, unit, rate, amount)')
      .eq('source_system', 'zoho_eu_2')
      .order(sortField, { ascending: sortDir === 'asc', nullsFirst: false })
      .limit(500);
    if (err) setError(err.message);
    const loaded = data ?? [];

    const orderIds = loaded.map(o => o.id);
    const approvalMap: Record<string, boolean> = {};
    if (canSeeApproval && orderIds.length > 0) {
      const { data: apps } = await (supabase as any)
        .from('order_at_approval')
        .select('order_id, bestellfreigabe')
        .in('order_id', orderIds);
      (apps || []).forEach((a: any) => {
        if (a.bestellfreigabe) approvalMap[a.order_id] = true;
      });
    }

    const expanded = loaded.map(o => ({
      ...o,
      _seq: 1,
      _displayNumber: withAt(o.order_number, o.source_system),
      _atApproved: !!approvalMap[o.id],
    }));

    setOrders(expanded);
    setLoading(false);
  }

  useEffect(() => { load(); }, [sortField, sortDir]);

  const EXCLUDED_STATUSES = ['geliefert', 'teilgeliefert', 'anwalt', 'zurückgestellt', 'hold', 'on hold', 'on_hold'];

  const statuses = [...new Set(orders.map(o => o.order_status).filter(Boolean))]
    .filter(s => !EXCLUDED_STATUSES.includes(s.toLowerCase()));

  const resolveCity = (order: any): string => {
    const hasAddr = (a: any) => a && (a.city || a.address || a.street);
    const addr =
      (hasAddr(order.shipping_address) ? order.shipping_address : null) ||
      (hasAddr(order.customers?.shipping_address) ? order.customers?.shipping_address : null) ||
      (hasAddr(order.billing_address) ? order.billing_address : null) ||
      (hasAddr(order.customers?.billing_address) ? order.customers?.billing_address : null);
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    return addr.city || addr.state || '';
  };

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const modelMatch = o.order_items?.some((it: any) =>
      it.item_name?.toLowerCase().includes(q) ||
      it.description?.toLowerCase().includes(q) ||
      it.sku?.toLowerCase().includes(q)
    );
    const matchSearch = !search ||
      o.order_number?.toLowerCase().includes(q) ||
      o._displayNumber?.toLowerCase().includes(q) ||
      o.customers?.company_name?.toLowerCase().includes(q) ||
      o.customers?.contact_name?.toLowerCase().includes(q) ||
      resolveCity(o)?.toLowerCase().includes(q) ||
      modelMatch;
    const matchStatus = statusFilter === 'all' || o.order_status === statusFilter;
    const matchModel = modelFilter === 'all' || o.order_items?.some((it: any) => {
      const m = modelFilter.toLowerCase();
      return it.item_name?.toLowerCase().includes(m) ||
        it.description?.toLowerCase().includes(m) ||
        it.sku?.toLowerCase().includes(m);
    });
    const notExcluded = !EXCLUDED_STATUSES.includes((o.order_status || '').toLowerCase());
    return matchSearch && matchStatus && matchModel && notExcluded;
  });

  const sorted = vipFirst(filtered, isOrderVip);

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(sorted.length / pageSize);
  const paged = pageSize === 'all' ? sorted : sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, modelFilter, pageSize]);

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
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" />
          Aufträge AT 🇦🇹
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{filtered.length} Aufträge (Alix Austria · -AT)</p>
      </div>

      <div className="space-y-4">
        <OrderStatsBar
          orders={orders.filter(o => !EXCLUDED_STATUSES.includes((o.order_status || '').toLowerCase()))}
          filteredCount={filtered.length}
          label="Aufträge"
        />
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Suche nach Auftrag, Kunde, Ort, Modell, SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 bg-secondary border-border">
              <SelectValue placeholder="Status filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={modelFilter} onValueChange={setModelFilter}>
            <SelectTrigger className="w-56 bg-secondary border-border">
              <SelectValue placeholder="Gerät filtern" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="all">Alle Geräte</SelectItem>
              {ALIX_MODEL_GROUPS.map(group => (
                <div key={group.label}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.label}</div>
                  {group.models.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(pageSize)} onValueChange={v => setPageSize(v === 'all' ? 'all' : Number(v) as 20 | 30 | 50)}>
            <SelectTrigger className="w-36 bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20 pro Seite</SelectItem>
              <SelectItem value="30">30 pro Seite</SelectItem>
              <SelectItem value="50">50 pro Seite</SelectItem>
              <SelectItem value="all">Alle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

        <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <SortHeader field="order_number" label="Auftrag Nr." />
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                  <SortHeader field="order_date" label="Datum" />
                  <SortHeader field="total_amount" label="Betrag" />
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                  {canSeeApproval && (
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Freigabe AT</th>
                  )}
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Anzahlung OK</th>
                  {canWrite && <th className="text-right px-4 py-3 text-muted-foreground font-medium">Aktionen</th>}
                </tr>
              </thead>
              {loading ? (
                <tbody>
                  <tr><td colSpan={(canWrite ? 7 : 6) + (canSeeApproval ? 1 : 0)} className="px-4 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                  </td></tr>
                </tbody>
              ) : filtered.length === 0 ? (
                <tbody>
                  <tr><td colSpan={(canWrite ? 7 : 6) + (canSeeApproval ? 1 : 0)} className="px-4 py-12 text-center">
                    <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-muted-foreground">Keine Aufträge gefunden.</p>
                  </td></tr>
                </tbody>
              ) : (
                paged.map(o => (
                  <tbody key={`${o.id}-${o._seq}`} className="border-b border-border">
                    <tr
                      className="hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/auftraege/${o.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        <span className="inline-flex items-center gap-2">
                          {isOrderVip(o) && <VipBadge size="sm" iconOnly />}
                          {o._displayNumber || o.order_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="flex flex-col">
                          <span className="text-foreground">{o.customers?.company_name || o.customers?.contact_name || '—'}</span>
                          {o.salesperson_name && (
                            <span className="text-xs text-muted-foreground">Vertrieb: {o.salesperson_name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{o.order_date ? new Date(o.order_date).toLocaleDateString('de-DE') : '—'}</td>
                      <td className="px-4 py-3 text-foreground">
                        {o.total_amount != null ? Number(o.total_amount).toLocaleString('de-DE', { style: 'currency', currency: o.currency || 'EUR' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.order_status || 'offen'} />
                      </td>
                      {canSeeApproval && (
                        <td className="px-4 py-3 text-xs">
                          {o._atApproved ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/15 border border-green-500/40 text-green-400 font-medium">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Freigabe erteilt
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs">
                        {o.deposit_ok ? (
                          <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                            ✓ {o.deposit_ok_by || 'Ja'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setEditOrder(o)}>
                              <Pencil className="w-3 h-3 mr-1" /> Ändern
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setDeferOrder(o)}>
                              <CalendarClock className="w-3 h-3 mr-1" /> Zurückstellen
                            </Button>
                            {canEditItems && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary hover:text-primary" onClick={() => setItemsOrder(o)}>
                                <Package className="w-3 h-3 mr-1" /> Artikel
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  </tbody>
                ))
              )}
            </table>
          </div>
        </div>

        {pageSize !== 'all' && totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Seite {currentPage} von {totalPages} · {filtered.length} Ergebnisse
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                Zurück
              </Button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let page: number;
                if (totalPages <= 7) page = i + 1;
                else if (currentPage <= 4) page = i + 1;
                else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                else page = currentPage - 3 + i;
                return (
                  <Button key={page} variant={page === currentPage ? 'default' : 'outline'} size="sm" className="h-7 w-7 px-0 text-xs" onClick={() => setCurrentPage(page)}>
                    {page}
                  </Button>
                );
              })}
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                Weiter
              </Button>
            </div>
          </div>
        )}
      </div>

      {editOrder && (
        <OrderEditDialog order={editOrder} open onClose={() => setEditOrder(null)} onSaved={load} />
      )}
      {deferOrder && (
        <OrderDeferDialog order={deferOrder} open onClose={() => setDeferOrder(null)} onSaved={load} />
      )}
      {itemsOrder && (
        <OrderItemsEditDialog
          orderId={itemsOrder.id}
          orderNumber={itemsOrder._displayNumber || itemsOrder.order_number}
          open
          onClose={() => setItemsOrder(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
