import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Search, Banknote } from 'lucide-react';

export default function Finance() {
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('finance_records')
        .select('*, orders(order_number)')
        .order('created_at', { ascending: false })
        .limit(100);
      setRecords(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = records.filter(r =>
    r.orders?.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.payment_status?.toLowerCase().includes(search.toLowerCase()) ||
    r.invoice_status?.toLowerCase().includes(search.toLowerCase())
  );

  const paymentColor = (s: string | null) => {
    if (s === 'bezahlt') return 'bg-success/10 text-success';
    if (s === 'überfällig') return 'bg-destructive/10 text-destructive';
    return 'bg-warning/10 text-warning';
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Banknote className="w-6 h-6 text-primary" />
          Finance
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{filtered.length} Einträge</p>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Suche..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
      </div>

      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Auftrag</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Fällig</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Betrag fällig</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Bezahlt</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Zahlungsstatus</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Rechnungsstatus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Laden...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Keine Einträge gefunden.</td></tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{r.orders?.order_number || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.due_date ? new Date(r.due_date).toLocaleDateString('de-DE') : '—'}</td>
                    <td className="px-4 py-3 text-right text-foreground">
                      {r.amount_due != null ? Number(r.amount_due).toLocaleString('de-DE', { style: 'currency', currency: r.currency || 'EUR' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      {r.amount_paid != null ? Number(r.amount_paid).toLocaleString('de-DE', { style: 'currency', currency: r.currency || 'EUR' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentColor(r.payment_status)}`}>
                        {r.payment_status || 'offen'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.invoice_status || '—'}</td>
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
