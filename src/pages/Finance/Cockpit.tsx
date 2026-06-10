import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Banknote, AlertTriangle, Users, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

export default function FinanceCockpit() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tx, setTx] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
      const [t, a, r] = await Promise.all([
        supabase.from('finance_transactions').select('amount, transaction_type, booking_date, customer:customer_id(source_system, company_name, contact_name)').gte('booking_date', yearStart).order('booking_date'),
        supabase.from('finance_accounts').select('customer_id, current_balance, overdue_balance, customers:customer_id(company_name, contact_name, source_system)').order('overdue_balance', { ascending: false }).limit(50),
        supabase.from('finance_reminders' as any).select('id, status').neq('status', 'erledigt'),
      ]);
      setTx(t.data ?? []);
      setAccounts(a.data ?? []);
      setReminders((r.data ?? []) as any[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <PageLoading />;

  const now = new Date();
  const mtd = tx.filter(r => new Date(r.booking_date).getMonth() === now.getMonth() && r.transaction_type === 'Rechnung').reduce((s, r) => s + Number(r.amount), 0);
  const ytd = tx.filter(r => r.transaction_type === 'Rechnung').reduce((s, r) => s + Number(r.amount), 0);
  const paid = tx.filter(r => r.transaction_type === 'Zahlung').reduce((s, r) => s + Number(r.amount), 0);
  const openBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const overdueBalance = accounts.reduce((s, a) => s + Number(a.overdue_balance || 0), 0);

  // Per month income
  const months: Record<string, { month: string; de: number; at: number }> = {};
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), i, 1);
    const k = d.toISOString().slice(0, 7);
    months[k] = { month: d.toLocaleDateString('de-DE', { month: 'short' }), de: 0, at: 0 };
  }
  for (const r of tx) {
    if (r.transaction_type !== 'Rechnung') continue;
    const k = r.booking_date.slice(0, 7);
    if (!months[k]) continue;
    const src = r.customer?.source_system;
    if (src === 'zoho_eu_2') months[k].at += Number(r.amount);
    else months[k].de += Number(r.amount);
  }
  const monthData = Object.values(months);

  const topDebtors = accounts.filter(a => Number(a.overdue_balance) > 0).slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader title="Finance Cockpit" subtitle="Konsolidiertes Reporting für Geschäftsführung & Finance" icon={TrendingUp} />

      <div className="grid md:grid-cols-4 gap-4">
        <DataCard title="Umsatz MTD"><div className="text-2xl font-semibold">{fmt(mtd)}</div></DataCard>
        <DataCard title="Umsatz YTD"><div className="text-2xl font-semibold">{fmt(ytd)}</div></DataCard>
        <DataCard title="Offene Forderungen"><div className="text-2xl font-semibold">{fmt(openBalance)}</div><div className="text-xs text-muted-foreground">{accounts.length} Debitoren</div></DataCard>
        <DataCard title="Überfällig"><div className="text-2xl font-semibold text-destructive">{fmt(overdueBalance)}</div><div className="text-xs text-muted-foreground">{reminders.length} aktive Mahnungen</div></DataCard>
      </div>

      <DataCard title="Monatsumsatz pro Mandant (laufendes Jahr)">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={monthData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Legend />
              <Bar dataKey="de" name="Alix Deutschland 🇩🇪" fill="hsl(var(--primary))" />
              <Bar dataKey="at" name="Alix Austria 🇦🇹" fill="hsl(var(--accent))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </DataCard>

      <div className="grid md:grid-cols-2 gap-4">
        <DataCard title="Cashflow YTD">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={[
                { name: 'Rechnungen', value: ytd },
                { name: 'Zahlungen', value: paid },
                { name: 'Offen', value: openBalance },
              ]}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DataCard>

        <DataCard title="Top 10 Schuldner">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b border-border"><th className="p-2">Kunde</th><th className="p-2 text-right">Überfällig</th><th></th></tr></thead>
              <tbody>
                {topDebtors.map((a, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="p-2">{a.customers?.company_name || a.customers?.contact_name || a.customer_id}</td>
                    <td className="p-2 text-right text-destructive font-medium">{fmt(Number(a.overdue_balance))}</td>
                    <td className="p-2"><Button size="sm" variant="ghost" onClick={() => nav(`/finance/mahnwesen/${a.customer_id}`)}><ArrowRight className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
                {topDebtors.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Keine überfälligen Debitoren</td></tr>}
              </tbody>
            </table>
          </div>
        </DataCard>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Button variant="outline" onClick={() => nav('/finance/mahnwesen')}><AlertTriangle className="h-4 w-4 mr-2" />Mahnwesen</Button>
        <Button variant="outline" onClick={() => nav('/finance/bank')}><Banknote className="h-4 w-4 mr-2" />Bankimport</Button>
        <Button variant="outline" onClick={() => nav('/finance/sepa')}><Users className="h-4 w-4 mr-2" />SEPA-Läufe</Button>
        <Button variant="outline" onClick={() => nav('/finance/steuer')}>Steuer-Auswertung</Button>
      </div>
    </div>
  );
}
