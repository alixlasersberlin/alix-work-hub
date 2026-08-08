import { useEffect, useState } from 'react';
import { Monitor, RefreshCw, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';

const eur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));

export default function FinanceCollectCockpit() {
  const [report, setReport] = useState<any>(null);
  const [forecast, setForecast] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const [r, f] = await Promise.all([
      supabase.from('collect_morning_reports' as any).select('*').order('report_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('collect_liquidity_forecast' as any).select('*').order('forecast_date', { ascending: false }).limit(3),
    ]);
    setReport((r.data as any) ?? null);
    setForecast((f.data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const generate = async () => {
    setRunning(true);
    await supabase.functions.invoke('collect-analytics');
    const { error } = await supabase.functions.invoke('collect-morning-report');
    setRunning(false);
    if (error) { toast({ title: 'Report fehlgeschlagen', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Morgenreport erstellt' });
    load();
  };

  const k = (report?.kpis ?? {}) as any;

  return (
    <div className="space-y-6">
      <PageHeader title="Executive Cockpit" subtitle="Wall-View: Forderungslage, Liquidität und KI-Morgenreport" icon={Monitor}
        actions={<Button variant="outline" onClick={generate} disabled={running}><RefreshCw className={`mr-2 h-4 w-4 ${running ? 'animate-spin' : ''}`} />Report erzeugen</Button>} />

      {loading ? (
        <SkeletonTable rows={6} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <DataCard title="Offene Forderungen"><div className="text-3xl font-semibold">{eur(k.open_amount ?? 0)}</div><div className="text-xs text-muted-foreground">{k.open_invoices ?? 0} Rechnungen</div></DataCard>
            <DataCard title="Überfällig"><div className="text-3xl font-semibold text-destructive">{eur(k.overdue_amount ?? 0)}</div></DataCard>
            <DataCard title="Anrufe heute"><div className="text-3xl font-semibold">{k.calls_today ?? 0}</div><div className="text-xs text-muted-foreground">{k.high_risk ?? 0} Hochrisiko</div></DataCard>
            <DataCard title="Cashflow 30 Tage"><div className="text-3xl font-semibold text-emerald-500">{eur(k.cashflow_30 ?? 0)}</div><div className="text-xs text-muted-foreground">erwartet heute {eur(k.expected_today ?? 0)}</div></DataCard>
          </div>

          <DataCard title={`KI-Morgenreport${report?.report_date ? ` · ${new Date(report.report_date).toLocaleDateString('de-DE')}` : ''}`} icon={<Sparkles className="h-4 w-4 text-primary" />}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{report?.summary ?? 'Noch kein Report vorhanden – erzeuge den ersten Morgenreport.'}</p>
            {Array.isArray(report?.recommendations) && report.recommendations.length > 0 && (
              <div className="mt-4 space-y-2">
                {report.recommendations.map((rec: any, i: number) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm">
                    <Badge variant="outline">{rec.type}</Badge>
                    <span className="font-medium">{rec.customer}</span>
                    <span>{eur(rec.amount)}</span>
                    <span className="text-xs text-muted-foreground">{rec.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </DataCard>

          <DataCard title="Liquiditätsprognose">
            {forecast.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Prognose berechnet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-3">Horizont</th>
                      <th className="py-2 pr-3">Sicher</th>
                      <th className="py-2 pr-3">Wahrscheinlich</th>
                      <th className="py-2 pr-3">Unsicher</th>
                      <th className="py-2 pr-3">Erwarteter Ausfall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.map((f) => (
                      <tr key={f.id} className="border-b border-border/50">
                        <td className="py-2 pr-3 font-medium">{f.horizon_days} Tage</td>
                        <td className="py-2 pr-3 text-emerald-500">{eur(f.secure_amount)}</td>
                        <td className="py-2 pr-3">{eur(f.probable_amount)}</td>
                        <td className="py-2 pr-3 text-amber-500">{eur(f.uncertain_amount)}</td>
                        <td className="py-2 pr-3 text-destructive">{eur(f.expected_loss)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>

          {Array.isArray(k.top_debtors) && k.top_debtors.length > 0 && (
            <DataCard title="Top-Schuldner">
              <div className="space-y-2">
                {k.top_debtors.map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between border-b border-border/50 py-2 text-sm">
                    <span className="font-medium">{i + 1}. {d.name}</span>
                    <span className="text-destructive">{eur(d.amount)}</span>
                  </div>
                ))}
              </div>
            </DataCard>
          )}
        </>
      )}
    </div>
  );
}
