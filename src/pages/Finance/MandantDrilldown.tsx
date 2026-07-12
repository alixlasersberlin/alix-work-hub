import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { maskRevenueString } from '@/lib/revenue-mask';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';
import { SkeletonKpiGrid } from '@/components/infinity/Skeleton';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/infinity/EmptyState';
import { ArrowLeft, TrendingUp, Banknote, AlertTriangle, Users, Inbox, Percent, Clock } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from 'recharts';

const _fmtBase = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const fmt = (n: number) => maskRevenueString(_fmtBase(n));

const MANDANT_META: Record<string, { label: string; source: string; suffix: string }> = {
  de: { label: 'Alix Deutschland 🇩🇪', source: 'zoho_eu_1', suffix: '' },
  at: { label: 'Alix Austria 🇦🇹', source: 'zoho_eu_2', suffix: '-AT' },
};

export default function MandantDrilldown() {
  const { code = 'de' } = useParams();
  const nav = useNavigate();
  const meta = MANDANT_META[code] ?? MANDANT_META.de;
  const [loading, setLoading] = useState(true);
  const [tx, setTx] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
      const [t, a, r] = await Promise.all([
        supabase
          .from('finance_transactions')
          .select('amount, transaction_type, booking_date, due_date, customer:customer_id(source_system, company_name, contact_name)')
          .gte('booking_date', yearStart)
          .order('booking_date'),
        supabase
          .from('finance_accounts')
          .select('customer_id, current_balance, overdue_balance, customers:customer_id(company_name, contact_name, source_system)')
          .order('overdue_balance', { ascending: false })
          .limit(200),
        supabase.from('finance_reminders' as any).select('id, status, customer_id, total_amount'),
      ]);
      setTx((t.data ?? []).filter((x: any) => x.customer?.source_system === meta.source));
      setAccounts((a.data ?? []).filter((x: any) => x.customers?.source_system === meta.source));
      setReminders(((r.data ?? []) as any[]));
      setLoading(false);
    })();
  }, [meta.source]);

  const now = new Date();

  const { mtd, ytd, paid, openBalance, overdueBalance, avgDso, monthData, topDebtors, paidRatio } = useMemo(() => {
    const mtd = tx.filter(r => new Date(r.booking_date).getMonth() === now.getMonth() && r.transaction_type === 'Rechnung').reduce((s, r) => s + Number(r.amount), 0);
    const ytd = tx.filter(r => r.transaction_type === 'Rechnung').reduce((s, r) => s + Number(r.amount), 0);
    const paid = tx.filter(r => r.transaction_type === 'Zahlung').reduce((s, r) => s + Number(r.amount), 0);
    const openBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
    const overdueBalance = accounts.reduce((s, a) => s + Number(a.overdue_balance || 0), 0);
    const dsoDays = tx
      .filter(r => r.transaction_type === 'Rechnung' && r.due_date)
      .map(r => (new Date(r.due_date).getTime() - new Date(r.booking_date).getTime()) / 86400000)
      .filter(n => n >= 0 && n < 365);
    const avgDso = dsoDays.length ? Math.round(dsoDays.reduce((a, b) => a + b, 0) / dsoDays.length) : 0;

    const months: Record<string, { month: string; rechnung: number; zahlung: number }> = {};
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), i, 1);
      const k = d.toISOString().slice(0, 7);
      months[k] = { month: d.toLocaleDateString('de-DE', { month: 'short' }), rechnung: 0, zahlung: 0 };
    }
    for (const r of tx) {
      const k = r.booking_date.slice(0, 7);
      if (!months[k]) continue;
      if (r.transaction_type === 'Rechnung') months[k].rechnung += Number(r.amount);
      else if (r.transaction_type === 'Zahlung') months[k].zahlung += Number(r.amount);
    }
    return {
      mtd, ytd, paid, openBalance, overdueBalance, avgDso,
      monthData: Object.values(months),
      topDebtors: accounts.filter(a => Number(a.overdue_balance) > 0).slice(0, 15),
      paidRatio: ytd > 0 ? Math.round((paid / ytd) * 100) : 0,
    };
  }, [tx, accounts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Cockpit · ${meta.label}`}
        subtitle="Mandanten-Drilldown mit Cashflow, offenen Posten und DSO"
        icon={TrendingUp}
        actions={<Button variant="ghost" size="sm" onClick={() => nav('/finance/cockpit')}><ArrowLeft className="h-4 w-4 mr-2" />Cockpit</Button>}
      />

      {loading ? (
        <SkeletonKpiGrid count={6} />
      ) : (
        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiTile label="Umsatz MTD" value={fmt(mtd)} icon={TrendingUp} accent="gold" />
          <KpiTile label="Umsatz YTD" value={fmt(ytd)} icon={Banknote} accent="emerald" />
          <KpiTile label="Zahlungseingang" value={fmt(paid)} icon={Banknote} accent="sky" />
          <KpiTile label="Offene Forderungen" value={fmt(openBalance)} icon={Users} accent="sky" />
          <KpiTile label="Überfällig" value={fmt(overdueBalance)} icon={AlertTriangle} accent="rose" />
          <KpiTile label="Ø DSO / Quote" value={`${avgDso}d · ${paidRatio}%`} icon={Clock} accent="violet" />
        </div>
      )}

      <DataCard title={`Cashflow ${now.getFullYear()} — ${meta.label}`}>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={monthData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Legend />
              <Bar dataKey="rechnung" name="Rechnungen" fill="hsl(var(--primary))" />
              <Bar dataKey="zahlung" name="Zahlungen" fill="hsl(var(--accent))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </DataCard>

      <DataCard title={`Top 15 überfällige Debitoren — ${meta.label}`}>
        {topDebtors.length === 0 ? (
          <EmptyState compact icon={Inbox} title="Keine überfälligen Debitoren" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border">
                  <th className="p-2">Kunde</th>
                  <th className="p-2 text-right">Offen</th>
                  <th className="p-2 text-right">Überfällig</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {topDebtors.map((a, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-2">{a.customers?.company_name || a.customers?.contact_name || a.customer_id}</td>
                    <td className="p-2 text-right">{fmt(Number(a.current_balance || 0))}</td>
                    <td className="p-2 text-right text-destructive font-medium">{fmt(Number(a.overdue_balance))}</td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => nav(`/finance/mahnwesen/${a.customer_id}`)}>
                        Mahnwesen
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
