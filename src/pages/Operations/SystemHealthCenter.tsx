import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/infinity/PageHeader';
import { toast } from 'sonner';
import {
  Activity, AlertTriangle, CheckCircle2, Database, HeartPulse, Loader2, PlayCircle,
  RefreshCw, ShieldCheck, Wrench, XCircle,
} from 'lucide-react';

type Run = {
  id: string; started_at: string; finished_at: string | null; score: number; status: string;
  trigger: string; metrics: any; breakdown: any; auto_actions: any[]; summary: string | null;
};
type Finding = {
  id: string; run_id: string; category: string; severity: string; title: string;
  detail: string | null; recommendation: string | null; target: string | null;
  needs_approval: boolean; status: string; created_at: string;
};
type Approval = {
  id: string; action_type: string; title: string; description: string | null;
  sql_preview: string | null; risk: string; status: string; note: string | null; created_at: string;
};

const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
const sevTone = (s: string) =>
  s === 'critical' ? 'text-destructive border-destructive/40'
    : s === 'high' ? 'text-amber-400 border-amber-500/40'
      : s === 'medium' ? 'text-yellow-300 border-yellow-500/30'
        : 'text-muted-foreground border-border';

const scoreTone = (n: number) =>
  n >= 90 ? 'text-emerald-400' : n >= 75 ? 'text-lime-400' : n >= 50 ? 'text-amber-400' : 'text-destructive';
const scoreLabel = (n: number) =>
  n >= 90 ? 'Sehr gut' : n >= 75 ? 'Gut, kleinere Optimierungen möglich' : n >= 50 ? 'Leistung beeinträchtigt' : 'Kritische Probleme';

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString('de-DE') : '—');
const fmtBytes = (b: number) => `${(Number(b || 0) / 1073741824).toFixed(2)} GB`;

function Card({ label, value, hint, icon: Icon, accent }: { label: string; value: string; hint?: string; icon: any; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <p className={`text-2xl font-display font-bold ${accent ?? 'text-foreground'}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export default function SystemHealthCenter() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: r }, { data: a }] = await Promise.all([
      supabase.from('sys_health_runs' as any).select('*').order('started_at', { ascending: false }).limit(30),
      supabase.from('sys_health_approvals' as any).select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    const runList = (r ?? []) as unknown as Run[];
    setRuns(runList);
    setApprovals((a ?? []) as unknown as Approval[]);
    if (runList[0]) {
      const { data: f } = await supabase.from('sys_health_findings' as any)
        .select('*').eq('run_id', runList[0].id).limit(300);
      const list = ((f ?? []) as unknown as Finding[])
        .sort((x, y) => SEV_ORDER.indexOf(x.severity) - SEV_ORDER.indexOf(y.severity));
      setFindings(list);
    } else setFindings([]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const latest = runs[0];
  const metrics = latest?.metrics ?? {};

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    findings.forEach((f) => { c[f.severity] = (c[f.severity] ?? 0) + 1; });
    return c;
  }, [findings]);

  async function runScan() {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('system-health-scan', {
        body: { trigger: 'manual' },
      });
      if (error) throw error;
      toast.success(`Systemprüfung abgeschlossen – Systemzustand ${(data as any)?.score ?? '?'} von 100`);
      await load();
    } catch (e: any) {
      toast.error(`Systemprüfung fehlgeschlagen: ${e?.message ?? e}`);
    } finally { setScanning(false); }
  }

  async function decide(id: string, status: 'approved' | 'rejected') {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('sys_health_approvals' as any)
      .update({ status, decided_by: user?.id ?? null, decided_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === 'approved' ? 'Freigegeben – Umsetzung erfolgt durch den Super Admin.' : 'Abgelehnt');
    load();
  }

  const pending = approvals.filter((a) => a.status === 'pending');

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="System Health Center"
        subtitle="Tägliche Health-, Sicherheits- und Performance-Prüfung mit risikoarmer Auto-Wartung"
        icon={HeartPulse}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Aktualisieren
            </Button>
            <Button size="sm" onClick={runScan} disabled={scanning}>
              {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
              Systemprüfung starten
            </Button>
          </div>
        }
      />

      {!latest && !loading && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          Noch keine Systemprüfung vorhanden. Starte die erste Prüfung über den Button oben rechts.
        </div>
      )}

      {latest && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card label="Systemzustand" value={`${latest.score} / 100`} icon={HeartPulse}
              accent={scoreTone(latest.score)} hint={scoreLabel(latest.score)} />
            <Card label="Letzte Prüfung" value={fmtDate(latest.finished_at ?? latest.started_at)} icon={Activity}
              hint={latest.trigger === 'cron' ? 'automatisch (03:00 Uhr)' : 'manuell gestartet'} />
            <Card label="Datenbankgröße" value={fmtBytes(metrics.db_size_bytes)} icon={Database}
              hint={`${metrics.tables_total ?? '—'} Tabellen`} />
            <Card label="Verbindungen" value={`${metrics.connections ?? '—'} / ${metrics.connections_max ?? '—'}`}
              icon={Activity} hint="Ziel: unter 80 %" />
            <Card label="Cache-Trefferquote"
              value={metrics.cache_hit_ratio != null ? `${(Number(metrics.cache_hit_ratio) * 100).toFixed(1)} %` : '—'}
              icon={Database} hint="Ziel: über 99 %" />
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {SEV_ORDER.filter((s) => counts[s]).map((s) => (
              <Badge key={s} variant="outline" className={sevTone(s)}>{counts[s]} × {s}</Badge>
            ))}
            {pending.length > 0 && (
              <Badge variant="outline" className="text-amber-400 border-amber-500/40">
                {pending.length} offene Freigaben
              </Badge>
            )}
          </div>

          <Tabs defaultValue="findings">
            <TabsList>
              <TabsTrigger value="findings">Befunde</TabsTrigger>
              <TabsTrigger value="approvals">Freigaben ({pending.length})</TabsTrigger>
              <TabsTrigger value="auto">Automatisch erledigt</TabsTrigger>
              <TabsTrigger value="history">Verlauf (30 Tage)</TabsTrigger>
              <TabsTrigger value="areas">Bereiche</TabsTrigger>
            </TabsList>

            <TabsContent value="findings" className="mt-4 space-y-3">
              {findings.length === 0 && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Keine Befunde – alles im grünen Bereich.
                </p>
              )}
              {findings.map((f) => (
                <div key={f.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={sevTone(f.severity)}>{f.severity}</Badge>
                        <Badge variant="outline">{f.category}</Badge>
                        {f.needs_approval && <Badge variant="outline" className="text-amber-400 border-amber-500/40">Freigabe nötig</Badge>}
                      </div>
                      <p className="font-medium mt-2">{f.title}</p>
                      {f.detail && <p className="text-xs text-muted-foreground mt-1 break-words font-mono">{f.detail}</p>}
                      {f.recommendation && (
                        <p className="text-sm text-muted-foreground mt-2">
                          <Wrench className="w-3 h-3 inline mr-1" />{f.recommendation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="approvals" className="mt-4 space-y-3">
              {approvals.length === 0 && <p className="text-sm text-muted-foreground">Keine Freigabe-Anfragen.</p>}
              {approvals.map((a) => (
                <div key={a.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{a.action_type}</Badge>
                        <Badge variant="outline" className={a.risk === 'high' ? 'text-destructive border-destructive/40' : ''}>Risiko: {a.risk}</Badge>
                        <Badge variant="outline" className={
                          a.status === 'approved' ? 'text-emerald-400 border-emerald-500/40'
                            : a.status === 'rejected' ? 'text-muted-foreground' : 'text-amber-400 border-amber-500/40'
                        }>{a.status}</Badge>
                      </div>
                      <p className="font-medium mt-2">{a.title}</p>
                      {a.description && <p className="text-xs text-muted-foreground mt-1">{a.description}</p>}
                      {a.sql_preview && (
                        <pre className="text-xs bg-muted/40 rounded p-2 mt-2 overflow-x-auto">{a.sql_preview}</pre>
                      )}
                    </div>
                    {a.status === 'pending' && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button size="sm" onClick={() => decide(a.id, 'approved')}>
                          <CheckCircle2 className="w-4 h-4 mr-1" />Freigeben
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => decide(a.id, 'rejected')}>
                          <XCircle className="w-4 h-4 mr-1" />Ablehnen
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Freigaben verändern die Datenbank nicht automatisch – sie dokumentieren die Entscheidung.
                Strukturelle Änderungen (Indizes, RLS, Schema) werden anschließend kontrolliert umgesetzt.
              </p>
            </TabsContent>

            <TabsContent value="auto" className="mt-4">
              <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                {(latest.auto_actions ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Keine automatischen Wartungsschritte ausgeführt.</p>
                )}
                {(latest.auto_actions ?? []).map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {a.ok === false
                      ? <AlertTriangle className="w-4 h-4 text-destructive" />
                      : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    <span className="font-mono text-xs">{a.action}</span>
                    {a.count != null && <span className="text-muted-foreground">– {a.count}</span>}
                    {a.error && <span className="text-destructive text-xs">{a.error}</span>}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <div className="rounded-lg border border-border bg-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="text-left p-3">Zeitpunkt</th>
                      <th className="text-left p-3">Auslöser</th>
                      <th className="text-right p-3">Systemzustand</th>
                      <th className="text-left p-3">Zusammenfassung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="p-3 whitespace-nowrap">{fmtDate(r.finished_at ?? r.started_at)}</td>
                        <td className="p-3">{r.trigger}</td>
                        <td className={`p-3 text-right font-semibold ${scoreTone(r.score)}`}>{r.score}</td>
                        <td className="p-3 text-muted-foreground">{r.summary ?? r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="areas" className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(latest.breakdown ?? {}).map(([k, v]) => (
                  <Card key={k} label={k} value={`${v}`} icon={ShieldCheck} accent={scoreTone(Number(v))} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
