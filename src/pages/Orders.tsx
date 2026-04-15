import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, ClipboardList, ArrowUpDown, Loader2, Inbox, CalendarDays, List, Car, Pencil, CalendarClock } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import OrdersCalendar from '@/components/OrdersCalendar';
import OrderEditDialog from '@/components/OrderEditDialog';
import OrderDeferDialog from '@/components/OrderDeferDialog';
import { useDrivingTimes } from '@/hooks/useDrivingTimes';

type SortField = 'order_number' | 'order_date' | 'total_amount' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [deferOrder, setDeferOrder] = useState<any>(null);
  const navigate = useNavigate();
  const { isAdmin, hasRole } = useAuth();
  const { drivingTimes, fetchDrivingTimes } = useDrivingTimes();

  const canWrite = isAdmin || hasRole('Auftragsverwaltung');

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('orders')
      .select('*, customers(company_name, contact_name, shipping_address, billing_address), order_items(id, item_name, quantity, unit, rate, amount)')
      .order(sortField, { ascending: sortDir === 'asc' })
      .limit(500);
    if (err) setError(err.message);
    const loaded = data ?? [];
    setOrders(loaded);
    setLoading(false);
    if (loaded.length > 0) fetchDrivingTimes(loaded);
  }

  useEffect(() => { load(); }, [sortField, sortDir, fetchDrivingTimes]);

  const statuses = [...new Set(orders.map(o => o.order_status).filter(Boolean))];

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      o.order_number?.toLowerCase().includes(q) ||
      o.customers?.company_name?.toLowerCase().includes(q) ||
      o.customers?.contact_name?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || o.order_status === statusFilter;
    return matchSearch && matchStatus;
  });

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
          Aufträge
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{filtered.length} Aufträge</p>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="list" className="gap-1.5">
            <List className="w-3.5 h-3.5" /> Liste
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> Kalender
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Suche nach Auftrag, Kunde..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
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
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                      <span className="inline-flex items-center gap-1"><Car className="w-3.5 h-3.5" /> Fahrzeit</span>
                    </th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Quelle</th>
                    {canWrite && <th className="text-right px-4 py-3 text-muted-foreground font-medium">Aktionen</th>}
                  </tr>
                </thead>
                {loading ? (
                  <tbody>
                    <tr><td colSpan={canWrite ? 8 : 7} className="px-4 py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                    </td></tr>
                  </tbody>
                ) : filtered.length === 0 ? (
                  <tbody>
                    <tr><td colSpan={canWrite ? 8 : 7} className="px-4 py-12 text-center">
                      <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-muted-foreground">Keine Aufträge gefunden.</p>
                    </td></tr>
                  </tbody>
                ) : (
                  filtered.map(o => (
                    <tbody key={o.id} className="border-b border-border">
                      <tr
                        className="hover:bg-secondary/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/auftraege/${o.id}`)}
                      >
                        <td className="px-4 py-3 font-medium text-foreground">{o.order_number}</td>
                        <td className="px-4 py-3 text-muted-foreground">{o.customers?.company_name || o.customers?.contact_name || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{o.order_date ? new Date(o.order_date).toLocaleDateString('de-DE') : '—'}</td>
                        <td className="px-4 py-3 text-foreground">
                          {o.total_amount != null ? Number(o.total_amount).toLocaleString('de-DE', { style: 'currency', currency: o.currency || 'EUR' }) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={o.order_status || 'offen'} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {drivingTimes[o.id] ? (
                            <span className="inline-flex items-center gap-1">
                              <Car className="w-3 h-3" />
                              {drivingTimes[o.id]!.duration_text} ({drivingTimes[o.id]!.distance_text})
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{o.source_system}</td>
                        {canWrite && (
                          <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setEditOrder(o)}
                              >
                                <Pencil className="w-3 h-3 mr-1" /> Ändern
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setDeferOrder(o)}
                              >
                                <CalendarClock className="w-3 h-3 mr-1" /> Zurückstellen
                              </Button>
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
        </TabsContent>

        <TabsContent value="calendar">
          <OrdersCalendar />
        </TabsContent>
      </Tabs>

      {editOrder && (
        <OrderEditDialog order={editOrder} open onClose={() => setEditOrder(null)} onSaved={load} />
      )}
      {deferOrder && (
        <OrderDeferDialog order={deferOrder} open onClose={() => setDeferOrder(null)} onSaved={load} />
      )}
    </div>
  );
}
