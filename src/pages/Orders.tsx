import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Search, ClipboardList } from 'lucide-react';

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('orders')
        .select('*, customers(company_name, contact_name)')
        .order('created_at', { ascending: false })
        .limit(100);
      setOrders(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = orders.filter(o =>
    o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.customers?.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.order_status?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Auftragsverwaltung
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} Aufträge</p>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Suche nach Auftrag, Kunde, Status..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 bg-secondary border-border"
        />
      </div>

      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Auftrag Nr.</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Datum</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Betrag</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Quelle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Laden...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Keine Aufträge gefunden.</td></tr>
              ) : (
                filtered.map(o => (
                  <tr key={o.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{o.order_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.customers?.company_name || o.customers?.contact_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.order_date ? new Date(o.order_date).toLocaleDateString('de-DE') : '—'}</td>
                    <td className="px-4 py-3 text-foreground">
                      {o.total_amount != null ? Number(o.total_amount).toLocaleString('de-DE', { style: 'currency', currency: o.currency || 'EUR' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {o.order_status || 'offen'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{o.source_system}</td>
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
