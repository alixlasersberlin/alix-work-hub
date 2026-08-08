import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';

const fmt = (n: any) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n ?? 0));

export default function FinanceCollectBi() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('collect_bi' as any);
      if (error) toast({ title: 'Laden fehlgeschlagen', description: error.message, variant: 'destructive' });
      setD(data ?? null);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="space-y-4"><SkeletonTable /></div>;

  const top20 = (d?.top20 ?? []) as any[];
  const byStage = (d?.by_stage ?? []) as any[];
  const weeks = (d?.payments_by_week ?? []) as any[];
  const regions = (d?.by_region ?? []) as any[];
  const rd = d?.return_debit_rate ?? {};
  const maxWeek = Math.max(1, ...weeks.map((w) => Number(w.amount ?? 0)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auswertungen"
        subtitle="Business Intelligence für Forderungen und Zahlungsverhalten"
        icon={BarChart3}
        actions={<Button variant="outline" size="sm" asChild><Link to="/finance/collect">Command Center</Link></Button>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <DataCard title="Zahlungseingänge nach Kalenderwoche">
          <div className="space-y-2">
            {weeks.map((w) => (
              <div key={w.week} className="text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">KW {w.week}</span><span>{fmt(w.amount)}</span></div>
                <div className="mt-1 h-1.5 rounded bg-muted">
                  <div className="h-1.5 rounded bg-primary" style={{ width: `${(Number(w.amount) / maxWeek) * 100}%` }} />
                </div>
              </div>
            ))}
            {weeks.length === 0 && <p className="text-sm text-muted-foreground">Keine Daten.</p>}
          </div>
        </DataCard>

        <DataCard title="Forderungen nach Mahnstufe">
          <div className="space-y-2">
            {byStage.map((s) => (
              <div key={s.stage_code ?? 'null'} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                <span className="text-muted-foreground">{s.stage_code ?? '–'}</span>
                <span className="flex items-center gap-3"><Badge variant="outline">{s.cnt}</Badge><span>{fmt(s.amount)}</span></span>
              </div>
            ))}
            {byStage.length === 0 && <p className="text-sm text-muted-foreground">Keine Daten.</p>}
          </div>
        </DataCard>

        <DataCard title="Forderungen nach Region / Mandant">
          <div className="space-y-2">
            {regions.map((r) => (
              <div key={r.region} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                <span className="text-muted-foreground">{r.region}</span>
                <span className="flex items-center gap-3"><Badge variant="outline">{r.cnt}</Badge><span>{fmt(r.amount)}</span></span>
              </div>
            ))}
            {regions.length === 0 && <p className="text-sm text-muted-foreground">Keine Daten.</p>}
          </div>
        </DataCard>

        <DataCard title="Kennzahlen">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Rücklastschriften</span><span>{rd.returns ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Zahlungseingänge gesamt</span><span>{rd.payments ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Rücklastschriftquote</span>
              <span>{rd.payments ? ((Number(rd.returns) / Number(rd.payments)) * 100).toFixed(2) : '0,00'} %</span></div>
            <div className="flex justify-between border-t border-border pt-2"><span className="text-muted-foreground">Mahngebühren offen</span><span>{fmt(d?.dunning_costs?.fees)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Verzugszinsen offen</span><span>{fmt(d?.dunning_costs?.interest)}</span></div>
          </div>
        </DataCard>
      </div>

      <DataCard title="Top 20 Kunden nach offener Forderung">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 text-left font-medium">Kunde</th>
                <th className="py-2 text-right font-medium">Offen</th>
                <th className="py-2 text-right font-medium">Überfällig</th>
                <th className="py-2 text-right font-medium">Verzug</th>
                <th className="py-2 text-right font-medium">Zahlungs-W.</th>
                <th className="py-2 text-left font-medium">Risiko</th>
              </tr>
            </thead>
            <tbody>
              {top20.map((t, i) => (
                <tr key={t.id} className={`border-b border-border/50 ${i % 2 ? 'bg-muted/20' : ''}`}>
                  <td className="py-2"><Link to={`/finance/collect/${t.id}`} className="text-primary hover:underline">{t.customer_name ?? '–'}</Link></td>
                  <td className="py-2 text-right">{fmt(t.open_amount)}</td>
                  <td className="py-2 text-right text-red-400">{fmt(t.overdue_amount)}</td>
                  <td className="py-2 text-right">{t.max_days_overdue ?? 0} T</td>
                  <td className="py-2 text-right">{t.pay_probability_pct != null ? `${t.pay_probability_pct}%` : '–'}</td>
                  <td className="py-2">{t.risk_class ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataCard>
    </div>
  );
}
