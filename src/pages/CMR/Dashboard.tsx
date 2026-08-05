import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Loader2, TrendingUp, FileText, Receipt, Users, Package, Briefcase } from 'lucide-react';
import { useCmrTenant, cmrMoney } from '@/hooks/useCmrTenant';

export default function CmrDashboard() {
  const { tenantId, settings, loading } = useCmrTenant();
  const [kpi, setKpi] = useState<any>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setBusy(true);
      const { data } = await supabase.rpc('cmr_dashboard_kpis' as any, { _tenant_id: tenantId } as any);
      setKpi(data ?? null);
      setBusy(false);
    })();
  }, [tenantId]);

  const cur = settings?.default_currency || 'AED';

  if (loading || busy) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const tiles = [
    { label: 'Umsatz (Jahr)', value: cmrMoney(kpi?.revenue_year, cur), icon: TrendingUp },
    { label: 'Umsatz (Monat)', value: cmrMoney(kpi?.revenue_month, cur), icon: TrendingUp },
    { label: 'Offene Rechnungen', value: `${kpi?.open_invoices_count ?? 0} · ${cmrMoney(kpi?.open_invoices_amount, cur)}`, icon: Receipt },
    { label: 'Offene Angebote', value: `${kpi?.open_offers_count ?? 0} · ${cmrMoney(kpi?.open_offers_amount, cur)}`, icon: FileText },
    { label: 'Laufende Projekte', value: kpi?.running_projects ?? 0, icon: Briefcase },
    { label: 'Aktive Artikel', value: kpi?.active_items ?? 0, icon: Package },
    { label: 'Kunden', value: kpi?.customers_count ?? 0, icon: Users },
    { label: 'Neue Kunden (Monat)', value: kpi?.new_customers_month ?? 0, icon: Users },
  ];

  const monthly: { month: string; amount: number }[] = Array.isArray(kpi?.monthly) ? kpi.monthly : [];
  const max = Math.max(1, ...monthly.map((m) => Number(m.amount || 0)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="CMR Dashboard"
        subtitle={`${settings?.company_name ?? 'Cloud Marketing Research'} · ${settings?.city ?? 'Dubai'}`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.label}</div>
              <t.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-xl font-semibold">{t.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="text-sm font-medium mb-4">Monatlicher Umsatz (12 Monate)</div>
        {monthly.length === 0 ? (
          <div className="text-sm text-muted-foreground">Noch keine Rechnungen erfasst.</div>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {monthly.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${Math.max(4, (Number(m.amount) / max) * 130)}px` }}
                  title={cmrMoney(m.amount, cur)}
                />
                <div className="text-[10px] text-muted-foreground rotate-0">{m.month.slice(5)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
