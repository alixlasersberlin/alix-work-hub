import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Truck, Search, Loader2, Inbox, ArrowUpDown } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import OrderStatsBar from '@/components/OrderStatsBar';

type SortField = 'order_number' | 'expected_shipment_date' | 'total_amount';
type SortDir = 'asc' | 'desc';

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function DeliveredList() {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('order_number');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('orders')
        .select('id, order_number, order_status, order_date, expected_shipment_date, total_amount, currency, source_system, customers(company_name, contact_name)')
        .eq('order_status', 'geliefert')
        .order(sortField, { ascending: sortDir === 'asc' })
        .limit(500);
      if (err) setError(err.message);
      setOrders(data ?? []);
      setLoading(false);
    }
    load();
  }, [sortField, sortDir]);

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
            <Truck className="w-6 h-6 text-primary" />
            Auftrag geliefert
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} Aufträge mit Status „geliefert"</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suche nach Auftrag, Kunde..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
        </div>
      </div>

      <OrderStatsBar orders={orders} filteredCount={filtered.length} label="Aufträge geliefert" />

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
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">Keine Aufträge mit Status „geliefert" gefunden.</p>
                </td></tr>
              ) : (
                filtered.map(o => (
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
