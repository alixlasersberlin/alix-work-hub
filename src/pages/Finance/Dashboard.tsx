import { useCallback, useEffect, useState } from 'react';
import { Banknote, AlertTriangle, FileText, Wallet, ScrollText, ArrowDownToLine } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';
import { SkeletonKpiGrid } from '@/components/infinity/Skeleton';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { FinanceControllingWidget } from '@/components/finance/FinanceControllingWidget';

interface Kpi { label: string; value: string; icon: any; accent: 'gold' | 'sky' | 'emerald' | 'rose' | 'violet'; }

export default function FinanceDashboard() {
  const { region } = useAccountingRegion();
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: region === 'CH' ? 'CHF' : 'EUR' });
    // Eine einzige Server-Abfrage statt drei Tabellen-Scans im Client.
    const { data } = await supabase.rpc('finance_dashboard_kpis' as any, { _region: region });
    const k = (data ?? {}) as Record<string, number>;
    setKpis([
      { label: 'Offene Forderungen', value: fmt(Number(k.open || 0)), icon: Banknote, accent: 'gold' },
      { label: 'Überfällige Forderungen', value: fmt(Number(k.overdue || 0)), icon: AlertTriangle, accent: 'rose' },
      { label: 'Offene Anzahlungen', value: fmt(Number(k.deposits || 0)), icon: Wallet, accent: 'sky' },
      { label: 'Aktive Verträge', value: String(Number(k.contracts || 0)), icon: FileText, accent: 'violet' },
      { label: 'Offene Raten (monatlich)', value: fmt(Number(k.monthlyRates || 0)), icon: ScrollText, accent: 'gold' },
      { label: 'Zahlungseingänge', value: fmt(Number(k.payments || 0)), icon: ArrowDownToLine, accent: 'emerald' },
    ]);
    setLoading(false);
  }, [region]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useRealtimeRefresh(
    ['finance_accounts', 'finance_contracts', 'finance_transactions', 'finance_records'],
    load,
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        icon={Banknote}
        title={`Finance Dashboard · Buchhaltung ${region === 'CH' ? '🇨🇭 CH' : '🇪🇺 EU'}`}
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
      <FinanceControllingWidget />
    </div>
  );
}
