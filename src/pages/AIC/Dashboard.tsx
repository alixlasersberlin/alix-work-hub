import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertOctagon, TrendingUp, ListChecks, Sparkles, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

function fmtEur(v: number | null | undefined) {
  if (v == null) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

export default function AicDashboard() {
  const { data: runs } = useQuery({
    queryKey: ['aic', 'runs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('aic_analysis_runs')
        .select('id, status, trigger, started_at, finished_at, duration_ms, stats, error')
        .order('started_at', { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const lastRun = runs?.find((r) => r.status === 'success');
  const snapshot = (lastRun?.stats as any)?.snapshot;
  const summary = (lastRun?.stats as any)?.summary;

  const { data: counts } = useQuery({
    queryKey: ['aic', 'counts'],
    queryFn: async () => {
      const [insights, openTasks, risks, forecasts] = await Promise.all([
        supabase.from('aic_insights').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('aic_tasks').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('aic_insights').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('category', 'risiko'),
        supabase.from('aic_forecasts').select('id', { count: 'exact', head: true }),
      ]);
      return {
        insights: insights.count ?? 0,
        tasks: openTasks.count ?? 0,
        risks: risks.count ?? 0,
        forecasts: forecasts.count ?? 0,
      };
    },
  });

  const { data: latestForecasts } = useQuery({
    queryKey: ['aic', 'latest-forecasts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('aic_forecasts')
        .select('id, kind, value, unit, confidence, rationale, generated_at')
        .order('generated_at', { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: topInsights } = useQuery({
    queryKey: ['aic', 'top-insights'],
    queryFn: async () => {
      const { data } = await supabase
        .from('aic_insights')
        .select('id, module, category, title, severity, created_at')
        .eq('status', 'open')
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="Offene Insights" value={counts?.insights ?? 0} icon={Sparkles} accent="primary" />
        <KpiCard title="Offene Risiken" value={counts?.risks ?? 0} icon={AlertOctagon} accent="destructive" />
        <KpiCard title="Offene KI-Aufgaben" value={counts?.tasks ?? 0} icon={ListChecks} accent="primary" />
        <KpiCard title="Aktive Prognosen" value={counts?.forecasts ?? 0} icon={TrendingUp} accent="primary" />
      </div>

      {/* Geschäftsdaten-Snapshot */}
      {snapshot && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Live-Snapshot</h2>
            {lastRun && (
              <span className="text-xs text-muted-foreground">
                Letzte Analyse {formatDistanceToNow(new Date(lastRun.started_at), { addSuffix: true, locale: de })}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Stat label="Umsatz 30T" value={fmtEur(snapshot.auftraege?.umsatz_30_tage)} />
            <Stat label="Umsatz 90T" value={fmtEur(snapshot.auftraege?.umsatz_90_tage)} />
            <Stat label="Offene Aufträge" value={String(snapshot.auftraege?.offen_anzahl ?? 0)} />
            <Stat label="Offene Forderungen" value={fmtEur(snapshot.forderungen?.offen_gesamt)} />
            <Stat label="Überfällige Rechnungen" value={String(snapshot.forderungen?.ueberfaellig ?? 0)} />
            <Stat label="Reparaturen offen" value={String(snapshot.reparaturen?.offen ?? 0)} />
            <Stat label="Kunden gesamt" value={String(snapshot.kunden?.gesamt ?? 0)} />
            <Stat label="VIP-Kunden" value={String(snapshot.kunden?.vip ?? 0)} />
          </div>
        </Card>
      )}

      {/* Summary */}
      {summary && (
        <Card className="p-5 border-primary/40 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold mb-1">KI-Lageeinschätzung</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Insights */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-primary mb-3">Kritischste Erkenntnisse</h2>
          {!topInsights ? (
            <Skeleton className="h-40 w-full" />
          ) : topInsights.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Erkenntnisse. Starte eine Analyse.</p>
          ) : (
            <ul className="space-y-2">
              {topInsights.map((i) => (
                <li key={i.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                  <SeverityBadge severity={i.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{i.title}</span>
                      <Badge variant="outline" className="text-[10px]">{i.module}</Badge>
                      <CategoryBadge category={i.category} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Latest Forecasts */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-primary mb-3">Letzte Prognosen</h2>
          {!latestForecasts || latestForecasts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Prognosen.</p>
          ) : (
            <ul className="space-y-2">
              {latestForecasts.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <div className="text-sm font-medium">{f.kind}</div>
                    {f.rationale && <div className="text-xs text-muted-foreground">{f.rationale}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-primary">
                      {f.value != null ? Number(f.value).toLocaleString('de-DE') : '–'} {f.unit}
                    </div>
                    {f.confidence != null && (
                      <div className="text-[10px] text-muted-foreground">Konfidenz {Math.round(Number(f.confidence) * 100)}%</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Run history */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-primary mb-3">Analyse-Historie</h2>
        {!runs ? (
          <Skeleton className="h-32" />
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Analyse durchgeführt.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                {r.status === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : r.status === 'failed' ? (
                  <XCircle className="w-4 h-4 text-destructive" />
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground w-40">
                  {new Date(r.started_at).toLocaleString('de-DE')}
                </span>
                <Badge variant="outline" className="text-[10px]">{r.trigger}</Badge>
                <span className="text-xs text-muted-foreground">
                  {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : ''}
                </span>
                {r.error && <span className="text-xs text-destructive truncate">{r.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, accent }: { title: string; value: number | string; icon: any; accent: 'primary' | 'destructive' }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{title}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
        </div>
        <Icon className={accent === 'destructive' ? 'w-8 h-8 text-destructive/60' : 'w-8 h-8 text-primary/60'} />
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold mt-0.5">{value}</div>
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: number }) {
  const c =
    severity >= 4 ? 'bg-destructive/20 text-destructive border-destructive/40' :
    severity === 3 ? 'bg-amber-500/20 text-amber-500 border-amber-500/40' :
    'bg-blue-500/20 text-blue-500 border-blue-500/40';
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${c}`}>S{severity}</span>;
}

export function CategoryBadge({ category }: { category: string }) {
  const map: Record<string, string> = {
    risiko: 'bg-destructive/15 text-destructive',
    chance: 'bg-green-500/15 text-green-500',
    empfehlung: 'bg-primary/15 text-primary',
  };
  return <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${map[category] || 'bg-muted'}`}>{category}</span>;
}
