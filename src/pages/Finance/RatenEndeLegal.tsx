import { useEffect, useMemo, useState } from 'react';
import { Gavel, Loader2, RotateCcw, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard, PageError } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { useFinancePermissions } from '@/hooks/useFinancePermissions';

const fmt = (n: number, c = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(n || 0);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');

type Profile = {
  id: string;
  recurrence_name: string | null;
  reference_number: string | null;
  customer_name: string | null;
  company_name: string | null;
  start_date: string | null;
  end_date: string | null;
  last_sent_date: string | null;
  total: number | null;
  currency: string | null;
  updated_at?: string | null;
};

export default function RatenEndeLegal() {
  const { region } = useAccountingRegion();
  const { canWrite } = useFinancePermissions();
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('zoho_recurring_profiles')
      .select('id, recurrence_name, reference_number, customer_name, company_name, start_date, end_date, last_sent_date, total, currency, updated_at')
      .eq('accounting_region', region === 'CH' ? 'CH' : 'EU')
      .eq('status', 'legal_ended')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(2000);
    if (error) setError(error.message);
    else setRows((data ?? []) as Profile[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [region]);

  async function reactivate(p: Profile) {
    if (!confirm(`Vertrag „${p.recurrence_name || p.reference_number || ''}“ zurück zu Wiederkehrende Zahler?`)) return;
    setBusy(p.id);
    const { error } = await supabase
      .from('zoho_recurring_profiles')
      .update({ status: 'pruefung' } as any)
      .eq('id', p.id);
    setBusy(null);
    if (error) {
      toast({ title: 'Zurückholen fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Zurückgeholt', description: 'Der Vertrag liegt wieder unter Wiederkehrende Zahler (Prüfung).' });
    setRows(prev => prev.filter(r => r.id !== p.id));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      `${r.recurrence_name ?? ''} ${r.reference_number ?? ''} ${r.customer_name ?? ''} ${r.company_name ?? ''}`
        .toLowerCase().includes(q));
  }, [rows, search]);

  const sum = filtered.reduce((a, r) => a + Number(r.total || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Gavel}
        title="RATEN ENDE LEGAL"
        subtitle="Beendete Ratenverträge – es werden keine wiederkehrenden Rechnungen mehr erstellt"
      />

      {error && <PageError message={error} onRetry={load} />}

      <DataCard>
        <div className="flex items-center gap-3 p-3 border-b border-border">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kunde, Referenz…" className="pl-8" />
          </div>
          <Badge variant="secondary">{filtered.length} Verträge</Badge>
          <div className="ml-auto text-sm font-semibold tabular-nums">{fmt(sum)}</div>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lade…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Keine beendeten Ratenverträge.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left">Name / Referenz</th>
                  <th className="px-3 py-2 text-left">Kunde</th>
                  <th className="px-3 py-2 text-left">Start</th>
                  <th className="px-3 py-2 text-left">Ende</th>
                  <th className="px-3 py-2 text-left">Letzte Rechnung</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} className={i % 2 ? 'bg-muted/20' : ''}>
                    <td className="px-3 py-2 font-medium">{r.recurrence_name || r.reference_number || '—'}</td>
                    <td className="px-3 py-2">{r.company_name || r.customer_name || '—'}</td>
                    <td className="px-3 py-2">{fmtDate(r.start_date)}</td>
                    <td className="px-3 py-2">{fmtDate(r.end_date)}</td>
                    <td className="px-3 py-2">{fmtDate(r.last_sent_date)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(r.total || 0), r.currency || 'EUR')}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="outline" disabled={!canWrite || busy === r.id} onClick={() => reactivate(r)}>
                        {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
                        Zurückholen
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
