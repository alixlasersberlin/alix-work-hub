import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, PageError, DataCard } from '@/components/PageShell';
import { ScrollText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

type Row = {
  id: string;
  recurring_invoice_id: string | null;
  customer_name: string | null;
  reference_number: string | null;
  status: string | null;
  amount: number | null;
  next_invoice_date: string | null;
  end_date: string | null;
  start_date: string | null;
  currency: string | null;
};

function fmtMoney(n: number | null, c: string | null) {
  if (n == null) return '–';
  try { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(n); }
  catch { return `${n.toFixed(2)} ${c ?? ''}`; }
}
function fmtDate(d: string | null) { if (!d) return '–'; try { return new Date(d).toLocaleDateString('de-DE'); } catch { return d; } }

export default function FinanceRaten() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('zoho_recurring_profiles' as any)
        .select('id, recurring_invoice_id, customer_name, reference_number, status, amount, next_invoice_date, end_date, start_date, currency')
        .order('next_invoice_date', { ascending: true })
        .limit(2000);
      if (error) { setError(error.message); setRows([]); }
      else setRows((data ?? []) as any as Row[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => [r.customer_name, r.reference_number, r.recurring_invoice_id].some(v => (v ?? '').toLowerCase().includes(q)));
  }, [rows, search]);

  const monthlyTotal = useMemo(() => filtered.reduce((s, r) => s + Number(r.amount ?? 0), 0), [filtered]);

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={<ScrollText className="w-6 h-6 text-primary" />}
        title="Laufende Raten"
        subtitle="Periodische Rechnungs-Stammdaten (Quelle: Zoho)"
      />
      <DataCard className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suche: Kunde, Auftragsnr., Profil-ID…" className="pl-9" />
          </div>
          <div className="text-sm text-muted-foreground">
            {filtered.length} Profile • monatlich gesamt: <span className="text-foreground font-semibold">{fmtMoney(monthlyTotal, 'EUR')}</span>
          </div>
        </div>
      </DataCard>

      {error && <PageError message={error} onRetry={() => location.reload()} />}
      {loading ? <PageLoading /> : (
        <DataCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Profil</th>
                  <th className="text-left px-4 py-3 font-medium">Auftragsnr.</th>
                  <th className="text-left px-4 py-3 font-medium">Kunde</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Start</th>
                  <th className="text-left px-4 py-3 font-medium">Nächste</th>
                  <th className="text-left px-4 py-3 font-medium">Ende</th>
                  <th className="text-right px-4 py-3 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Keine laufenden Raten gefunden.</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs">{r.recurring_invoice_id ?? '–'}</td>
                    <td className="px-4 py-3">{r.reference_number ?? '–'}</td>
                    <td className="px-4 py-3">{r.customer_name ?? '–'}</td>
                    <td className="px-4 py-3">{r.status ?? '–'}</td>
                    <td className="px-4 py-3">{fmtDate(r.start_date)}</td>
                    <td className="px-4 py-3">{fmtDate(r.next_invoice_date)}</td>
                    <td className="px-4 py-3">{fmtDate(r.end_date)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(r.amount, r.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataCard>
      )}
    </div>
  );
}
