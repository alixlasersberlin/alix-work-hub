import { useCallback, useEffect, useState } from 'react';
import { Banknote, AlertTriangle, FileText, Wallet, ScrollText, ArrowDownToLine } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';
import { SkeletonKpiGrid } from '@/components/infinity/Skeleton';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

interface Kpi { label: string; value: string; icon: any; accent: 'gold' | 'sky' | 'emerald' | 'rose' | 'violet'; }

export default function FinanceDashboard() {
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    const [accountsRes, contractsRes, txRes] = await Promise.all([
      supabase.from('finance_accounts' as any).select('current_balance, overdue_balance'),
      supabase.from('finance_contracts' as any).select('id, status, monthly_rate, remaining_amount').eq('status', 'aktiv'),
      supabase.from('finance_transactions' as any).select('amount, transaction_type'),
    ]);
    const accounts = (accountsRes.data ?? []) as any[];
    const contracts = (contractsRes.data ?? []) as any[];
    const tx = (txRes.data ?? []) as any[];
    const open = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
    const overdue = accounts.reduce((s, a) => s + Number(a.overdue_balance || 0), 0);
    const deposits = tx.filter(t => t.transaction_type === 'Anzahlung').reduce((s, t) => s + Number(t.amount || 0), 0);
    const payments = tx.filter(t => t.transaction_type === 'Zahlung').reduce((s, t) => s + Number(t.amount || 0), 0);
    const monthlyRates = contracts.reduce((s, c) => s + Number(c.monthly_rate || 0), 0);
    setKpis([
      { label: 'Offene Forderungen', value: fmt(open), icon: Banknote, accent: 'gold' },
      { label: 'Überfällige Forderungen', value: fmt(overdue), icon: AlertTriangle, accent: 'rose' },
      { label: 'Offene Anzahlungen', value: fmt(deposits), icon: Wallet, accent: 'sky' },
      { label: 'Aktive Verträge', value: String(contracts.length), icon: FileText, accent: 'violet' },
      { label: 'Offene Raten (monatlich)', value: fmt(monthlyRates), icon: ScrollText, accent: 'gold' },
      { label: 'Zahlungseingänge', value: fmt(payments), icon: ArrowDownToLine, accent: 'emerald' },
    ]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(
    ['finance_accounts', 'finance_contracts', 'finance_transactions', 'finance_records'],
    load,
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        icon={Banknote}
        title="Finance Dashboard"
        subtitle="Übersicht über Forderungen, Verträge und Zahlungen"
        meta={<InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : 'Live'} pulse={!loading} dotOnly />}
      />
      {loading ? (
        <SkeletonKpiGrid count={6} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map(k => (
            <KpiTile key={k.label} label={k.label} value={k.value} icon={k.icon} accent={k.accent} />
          ))}
        </div>
      )}
    </div>
  );
}
