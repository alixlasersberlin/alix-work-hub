import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, AlertTriangle, Loader2, Inbox, Pencil, CalendarClock, RotateCcw } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { toast } from 'sonner';
import OrderEditDialog from '@/components/OrderEditDialog';
import OrderDeferDialog from '@/components/OrderDeferDialog';

const DEFER_STATUS = 'zurückgestellt';

export default function OrdersInClarification() {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [deferOrder, setDeferOrder] = useState<any>(null);
  const [reactivating, setReactivating] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isAdmin, hasRole } = useAuth();
  const canWrite = isAdmin || hasRole('Auftragsverwaltung');

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('orders')
      .select('*, customers(company_name, contact_name, shipping_address, billing_address)')
      .eq('order_status', DEFER_STATUS)
      .order('expected_shipment_date', { ascending: true, nullsFirst: false })
      .limit(500);
    if (err) setError(err.message);
    setOrders(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Live-Update: neu zurückgestellte Aufträge automatisch hinzufügen
    const channel = supabase
      .channel('orders-in-klaerung')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return orders;
    return orders.filter(o =>
      o.order_number?.toLowerCase().includes(q) ||
      o.customers?.company_name?.toLowerCase().includes(q) ||
      o.customers?.contact_name?.toLowerCase().includes(q)
    );
  }, [orders, search]);

  async function reactivate(o: any) {
    setReactivating(o.id);
    const { error: err } = await supabase
      .from('orders')
      .update({ order_status: 'offen' })
      .eq('id', o.id);
    setReactivating(null);
    if (err) return toast.error(err.message);
    toast.success(`${o.order_number} wieder aktiviert`);
    load();
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueLabel = (d: string | null) => {
    if (!d) return null;
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return { text: `${Math.abs(diff)} Tage überfällig`, cls: 'text-destructive' };
    if (diff === 0) return { text: 'heute fällig', cls: 'text-yellow-500' };
    if (diff <= 7) return { text: `in ${diff} Tagen`, cls: 'text-yellow-500' };
    return { text: `in ${diff} Tagen`, cls: 'text-muted-foreground' };
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-primary" />
          In Klärung
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filtered.length} zurückgestellte Aufträge
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Auftrag oder Kunde..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>
      </div>

      {error && <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">{error}</div>}

      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Auftrag Nr.</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Datum</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Zurückgestellt bis</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                {canWrite && <th className="text-right px-4 py-3 text-muted-foreground font-medium">Aktionen</th>}
              </tr>
            </thead>
            {loading ? (
              <tbody>
                <tr><td colSpan={canWrite ? 6 : 5} className="px-4 py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                </td></tr>
              </tbody>
            ) : filtered.length === 0 ? (
              <tbody>
                <tr><td colSpan={canWrite ? 6 : 5} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">Keine zurückgestellten Aufträge.</p>
                </td></tr>
              </tbody>
            ) : (
              <tbody>
                {filtered.map(o => {
                  const due = dueLabel(o.expected_shipment_date);
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/auftraege/${o.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{o.order_number}</td>
                      <td className="px-4 py-3 text-foreground">
                        {o.customers?.company_name || o.customers?.contact_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {o.order_date ? new Date(o.order_date).toLocaleDateString('de-DE') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {o.expected_shipment_date ? (
                          <div className="flex flex-col">
                            <span className="text-foreground">
                              {new Date(o.expected_shipment_date).toLocaleDateString('de-DE')}
                            </span>
                            {due && <span className={`text-xs font-medium ${due.cls}`}>{due.text}</span>}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={o.order_status || DEFER_STATUS} /></td>
                      {canWrite && (
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => reactivate(o)}
                              disabled={reactivating === o.id}
                            >
                              {reactivating === o.id
                                ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                : <RotateCcw className="w-3 h-3 mr-1" />}
                              Aktivieren
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setDeferOrder(o)}
                            >
                              <CalendarClock className="w-3 h-3 mr-1" /> Datum
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setEditOrder(o)}
                            >
                              <Pencil className="w-3 h-3 mr-1" /> Ändern
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
      </div>

      {editOrder && (
        <OrderEditDialog order={editOrder} open onClose={() => setEditOrder(null)} onSaved={load} />
      )}
      {deferOrder && (
        <OrderDeferDialog order={deferOrder} open onClose={() => setDeferOrder(null)} onSaved={load} />
      )}
    </div>
  );
}
