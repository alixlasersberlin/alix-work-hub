import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Search, Loader2, Inbox, Factory } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { PageSizeSelector, usePagination, PaginationControls } from '@/components/PageSizeSelector';

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function OrdersFreiBestellung() {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
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
      // Bestellungen ausblenden, für die bereits eine Produktionsbestellung existiert (→ Factory Orders)
      const { data: existing } = await supabase
        .from('production_orders')
        .select('order_id');
      const usedOrderIds = new Set((existing ?? []).map((p: any) => p.order_id));
      setOrders((data ?? []).filter((o: any) => !usedOrderIds.has(o.id)));
      setLoading(false);
    })();
  }, []);

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
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Mitarbeiter</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Freigabe am</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Anzahlung</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Lieferdatum</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">Keine Aufträge mit Anzahlungsbestätigung gefunden.</p>
                </td></tr>
              ) : (
                paged.map(o => (
                  <tr key={o.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground cursor-pointer" onClick={() => navigate(`/auftraege/${o.id}`)}>{o.order_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.customers?.company_name || o.customers?.contact_name || '—'}</td>
                    <td className="px-4 py-3 text-foreground">{o.deposit_ok_by || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.deposit_ok_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.deposit_amount != null ? `${Number(o.deposit_amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${o.currency || '€'}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.expected_shipment_date)}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.order_status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" onClick={() => navigate(`/order/neu?order_id=${o.id}`)}>
                        <Factory className="w-4 h-4 mr-1" /> Bestellung
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} total={total} />
    </div>
  );
}
