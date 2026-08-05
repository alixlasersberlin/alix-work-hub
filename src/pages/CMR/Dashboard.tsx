import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Loader2, TrendingUp, FileText, Receipt, Users, Package, Briefcase } from 'lucide-react';
import { useCmrTenant, cmrMoney } from '@/hooks/useCmrTenant';

export default function CmrDashboard() {
  const { tenantId, settings, loading } = useCmrTenant();
  const [kpi, setKpi] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ name: string; amount: number }[]>([]);
  const [trend, setTrend] = useState<{ ytd: number; prevYtd: number; prevFull: number; forecast: number } | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setBusy(true);
      const { data } = await supabase.rpc('cmr_dashboard_kpis' as any, { _tenant_id: tenantId } as any);
      setKpi(data ?? null);

      const today = new Date().toISOString().slice(0, 10);
      const { data: od } = await supabase
        .from('cmr_documents' as any)
        .select('id,doc_number,customer_name,due_date,gross_total,paid_total,currency')
        .eq('tenant_id', tenantId)
        .eq('doc_type', 'rechnung')
        .lt('due_date', today)
        .order('due_date', { ascending: true })
        .limit(50);
      setOverdue(((od as any[]) ?? []).filter((d) => Number(d.gross_total || 0) - Number(d.paid_total || 0) > 0.01).slice(0, 10));

      const yearStart = `${new Date().getFullYear()}-01-01`;
      const { data: docs } = await supabase
        .from('cmr_documents' as any)
        .select('customer_name,gross_total,doc_type,doc_date')
        .eq('tenant_id', tenantId)
        .in('doc_type', ['rechnung', 'gutschrift'])
        .gte('doc_date', yearStart)
        .limit(2000);
      const map = new Map<string, number>();
      ((docs as any[]) ?? []).forEach((d) => {
        const sign = d.doc_type === 'gutschrift' ? -1 : 1;
        const key = d.customer_name || '–';
        map.set(key, (map.get(key) ?? 0) + sign * Number(d.gross_total || 0));
      });
      setTopCustomers([...map.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 8));

      // Vorjahresvergleich & Forecast
      const now = new Date();
      const y = now.getFullYear();
      const { data: trendDocs } = await supabase
        .from('cmr_documents' as any)
        .select('doc_date,doc_type,gross_total')
        .eq('tenant_id', tenantId)
        .in('doc_type', ['rechnung', 'gutschrift'])
        .gte('doc_date', `${y - 1}-01-01`)
        .limit(5000);
      let ytd = 0, prevYtd = 0, prevFull = 0;
      const monthNow = now.getMonth() + 1;
      ((trendDocs as any[]) ?? []).forEach((d) => {
        const sign = d.doc_type === 'gutschrift' ? -1 : 1;
        const amt = sign * Number(d.gross_total || 0);
        const dy = Number(String(d.doc_date).slice(0, 4));
        const dm = Number(String(d.doc_date).slice(5, 7));
        if (dy === y) ytd += amt;
        else if (dy === y - 1) {
          prevFull += amt;
          if (dm <= monthNow) prevYtd += amt;
        }
      });
      const elapsed = monthNow - 1 + now.getDate() / 30;
      setTrend({ ytd, prevYtd, prevFull, forecast: elapsed > 0 ? (ytd / elapsed) * 12 : ytd });

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

      {trend && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Umsatz YTD</div>
            <div className="mt-2 text-xl font-semibold">{cmrMoney(trend.ytd, cur)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Vorjahr (gleicher Zeitraum)</div>
            <div className="mt-2 text-xl font-semibold">{cmrMoney(trend.prevYtd, cur)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Veränderung</div>
            <div className={`mt-2 text-xl font-semibold ${trend.ytd >= trend.prevYtd ? 'text-emerald-500' : 'text-destructive'}`}>
              {trend.prevYtd > 0 ? `${(((trend.ytd - trend.prevYtd) / trend.prevYtd) * 100).toFixed(1)} %` : '—'}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Forecast Jahresende</div>
            <div className="mt-2 text-xl font-semibold">{cmrMoney(trend.forecast, cur)}</div>
            <div className="text-[11px] text-muted-foreground mt-1">Vorjahr gesamt: {cmrMoney(trend.prevFull, cur)}</div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Überfällige Rechnungen</div>
            <Link to="/cmr/mahnwesen" className="text-xs text-primary hover:underline">Mahnwesen</Link>
          </div>
          {overdue.length === 0 ? (
            <div className="text-sm text-muted-foreground">Keine überfälligen Rechnungen.</div>
          ) : (
            <div className="space-y-2">
              {overdue.map((d) => {
                const open = Number(d.gross_total || 0) - Number(d.paid_total || 0);
                const days = Math.floor((Date.now() - new Date(d.due_date).getTime()) / 86400000);
                return (
                  <div key={d.id} className="flex items-center justify-between gap-3 text-sm border-b border-border/50 pb-2 last:border-0">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{d.doc_number} · {d.customer_name || '–'}</div>
                      <div className="text-[11px] text-muted-foreground">fällig {d.due_date}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="destructive" className="text-[10px]">{days} T</Badge>
                      <span className="tabular-nums">{cmrMoney(open, d.currency || cur)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium mb-3">Top-Kunden (laufendes Jahr)</div>
          {topCustomers.length === 0 ? (
            <div className="text-sm text-muted-foreground">Noch keine Umsätze erfasst.</div>
          ) : (
            <div className="space-y-2">
              {topCustomers.map((c) => (
                <div key={c.name} className="flex items-center justify-between gap-3 text-sm border-b border-border/50 pb-2 last:border-0">
                  <span className="truncate">{c.name}</span>
                  <span className="tabular-nums font-medium">{cmrMoney(c.amount, cur)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

    </div>
  );
}
