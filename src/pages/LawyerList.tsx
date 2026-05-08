import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Gavel, Search, Loader2, Inbox, ArrowUpDown, Pencil } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import OrderStatsBar from '@/components/OrderStatsBar';
import OrderEditDialog from '@/components/OrderEditDialog';
import { useAuth } from '@/hooks/useAuth';

type SortField = 'order_number' | 'expected_shipment_date' | 'total_amount';
type SortDir = 'asc' | 'desc';

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function LawyerList() {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('order_number');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOrder, setEditOrder] = useState<any | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canEdit = hasRole('Admin') || hasRole('Super Admin') || hasRole('Auftragsverwaltung');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('orders')
        .select('id, order_number, order_status, order_date, expected_shipment_date, total_amount, currency, source_system, lawyer_reason, salesperson_name, internal_number, customers(company_name, contact_name)')
        .ilike('order_status', 'anwalt')
        .order(sortField, { ascending: sortDir === 'asc' })
        .limit(500);
      if (err) setError(err.message);
      setOrders(data ?? []);
      setLoading(false);
    }
    load();
  }, [sortField, sortDir, reloadKey]);

  const filtered = useMemo(() => orders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(q) ||
      o.customers?.company_name?.toLowerCase().includes(q) ||
      o.customers?.contact_name?.toLowerCase().includes(q)
    );
  }), [orders, search]);

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
            <Gavel className="w-6 h-6 text-primary" />
            Anwaltsliste
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} Fälle mit Status „Anwalt"</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suche nach Auftrag, Kunde..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
        </div>
      </div>

      <OrderStatsBar orders={orders} filteredCount={filtered.length} label="Anwaltsfälle" />

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <SortHeader field="order_number" label="Auftragsnr." />
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Grund</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kontakt</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Auftragsdatum</th>
                <SortHeader field="expected_shipment_date" label="Lieferdatum" />
                <SortHeader field="total_amount" label="Betrag" />
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">Keine Fälle mit Status „Anwalt" gefunden.</p>
                </td></tr>
              ) : (
                filtered.map(o => (
                  <tr key={o.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground cursor-pointer" onClick={() => navigate(`/auftraege/${o.id}`)}>{o.order_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.customers?.company_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.customers?.contact_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.order_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.expected_shipment_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.total_amount != null ? `${o.total_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${o.currency || '€'}` : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={o.order_status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{o.lawyer_reason || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditOrder(o); }}>
                          <Pencil className="w-3 h-3 mr-1" /> Bearbeiten
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editOrder && (
        <OrderEditDialog
          order={editOrder}
          open={!!editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={() => setReloadKey(k => k + 1)}
        />
      )}
    </div>
  );
}
