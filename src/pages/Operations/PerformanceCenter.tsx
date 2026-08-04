import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Gauge, Loader2, RefreshCw, Database, Zap, ListTree, Trash2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { getPerfSamples, subscribePerfSamples, clearPerfSamples, type PerfSample } from '@/lib/perf/queryProbe';

type SlowQuery = { query: string; calls: number; mean_ms: number; max_ms: number; total_ms: number; rows_avg: number };
type TableStat = { table_name: string; live_rows: number; total_bytes: number; total_pretty: string; seq_scans: number; idx_scans: number; seq_ratio: number };
type UnusedIndex = { table_name: string; index_name: string; index_scans: number; index_pretty: string };

const fmtMs = (n: number) => `${Number(n).toLocaleString('de-DE', { maximumFractionDigits: 0 })} ms`;
const fmtNum = (n: number) => Number(n).toLocaleString('de-DE');

/** Ampel gemäß Zielvorgabe: < 300 ms grün, < 1000 ms gelb, darüber rot. */
function tone(ms: number) {
  if (ms < 300) return 'text-emerald-400';
  if (ms < 1000) return 'text-amber-400';
  return 'text-destructive';
}

function KpiCard({ label, value, hint, icon: Icon, accent }: { label: string; value: string; hint?: string; icon: any; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 card-glow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <p className={`text-2xl font-display font-bold ${accent ?? 'text-foreground'}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function LiveTab() {
  const samples = useSyncExternalStore(subscribePerfSamples, getPerfSamples, getPerfSamples);

  const stats = useMemo(() => {
    if (!samples.length) return null;
    const sorted = [...samples].sort((a, b) => a.ms - b.ms);
    const p = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]?.ms ?? 0;
    const avg = Math.round(samples.reduce((s, x) => s + x.ms, 0) / samples.length);
    const bytes = samples.reduce((s, x) => s + (x.bytes ?? 0), 0);
    const slow = samples.filter(x => x.ms >= 1000).length;
    return { avg, p50: p(0.5), p95: p(0.95), bytes, slow };
  }, [samples]);

  /** Aggregation je Ziel (Tabelle / RPC) – zeigt die teuersten Endpunkte. */
  const byTarget = useMemo(() => {
    const m = new Map<string, { target: string; kind: string; calls: number; total: number; max: number }>();
    for (const s of samples) {
      const key = `${s.kind}:${s.target}`;
      const e = m.get(key) ?? { target: s.target, kind: s.kind, calls: 0, total: 0, max: 0 };
      e.calls++; e.total += s.ms; e.max = Math.max(e.max, s.ms);
      m.set(key, e);
    }
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 20);
  }, [samples]);

  /** Antwortzeit pro Modul (Route) – genau die von dir gewünschte Sicht. */
  const byRoute = useMemo(() => {
    const m = new Map<string, { route: string; calls: number; total: number }>();
    for (const s of samples) {
      const e = m.get(s.route) ?? { route: s.route, calls: 0, total: 0 };
      e.calls++; e.total += s.ms;
      m.set(s.route, e);
    }
    return [...m.values()].sort((a, b) => b.total / b.calls - a.total / a.calls).slice(0, 15);
  }, [samples]);

  const recent: PerfSample[] = [...samples].slice(-40).reverse();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Gemessene Abfragen" value={fmtNum(samples.length)} icon={Zap} hint="dieser Browser-Sitzung" />
        <KpiCard label="Durchschnitt" value={stats ? fmtMs(stats.avg) : '—'} icon={Gauge} accent={stats ? tone(stats.avg) : undefined} hint="Ziel: < 300 ms" />
        <KpiCard label="Median (p50)" value={stats ? fmtMs(stats.p50) : '—'} icon={Gauge} accent={stats ? tone(stats.p50) : undefined} />
        <KpiCard label="p95" value={stats ? fmtMs(stats.p95) : '—'} icon={Gauge} accent={stats ? tone(stats.p95) : undefined} hint="Ziel: < 2 s" />
        <KpiCard label="Übertragen" value={stats ? `${(stats.bytes / 1024 / 1024).toFixed(2)} MB` : '—'} icon={Database} hint={stats ? `${stats.slow} Abfragen > 1 s` : undefined} />
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={clearPerfSamples}>
          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Messwerte zurücksetzen
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card overflow-hidden card-glow">
          <div className="px-4 py-3 border-b border-border bg-secondary/40 text-sm font-medium">Teuerste Endpunkte</div>
          <table className="w-full text-sm">
            <thead><tr className="text-muted-foreground text-xs">
              <th className="text-left px-4 py-2 font-medium">Ziel</th>
              <th className="text-right px-4 py-2 font-medium">Aufrufe</th>
              <th className="text-right px-4 py-2 font-medium">Ø</th>
              <th className="text-right px-4 py-2 font-medium">Max</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {byTarget.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Noch keine Messwerte — navigiere durch die App.</td></tr>
              ) : byTarget.map(t => (
                <tr key={`${t.kind}:${t.target}`}>
                  <td className="px-4 py-2">
                    <span className="text-[10px] uppercase text-muted-foreground mr-2">{t.kind}</span>
                    <span className="font-medium text-foreground">{t.target}</span>
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{fmtNum(t.calls)}</td>
                  <td className={`px-4 py-2 text-right font-medium ${tone(t.total / t.calls)}`}>{fmtMs(t.total / t.calls)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{fmtMs(t.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden card-glow">
          <div className="px-4 py-3 border-b border-border bg-secondary/40 text-sm font-medium">Antwortzeit pro Modul</div>
          <table className="w-full text-sm">
            <thead><tr className="text-muted-foreground text-xs">
              <th className="text-left px-4 py-2 font-medium">Route</th>
              <th className="text-right px-4 py-2 font-medium">Abfragen</th>
              <th className="text-right px-4 py-2 font-medium">Ø</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {byRoute.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Noch keine Messwerte.</td></tr>
              ) : byRoute.map(r => (
                <tr key={r.route}>
                  <td className="px-4 py-2 font-mono text-xs text-foreground">{r.route}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{fmtNum(r.calls)}</td>
                  <td className={`px-4 py-2 text-right font-medium ${tone(r.total / r.calls)}`}>{fmtMs(r.total / r.calls)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden card-glow">
        <div className="px-4 py-3 border-b border-border bg-secondary/40 text-sm font-medium">Letzte Abfragen</div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card"><tr className="text-muted-foreground text-xs">
              <th className="text-left px-4 py-2 font-medium">Zeit</th>
              <th className="text-left px-4 py-2 font-medium">Ziel</th>
              <th className="text-left px-4 py-2 font-medium">Methode</th>
              <th className="text-right px-4 py-2 font-medium">Datensätze</th>
              <th className="text-right px-4 py-2 font-medium">Dauer</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {recent.map(s => (
                <tr key={s.id}>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(s.at).toLocaleTimeString('de-DE')}</td>
                  <td className="px-4 py-2 text-foreground">{s.target}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{s.method} · {s.status}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{s.rows != null ? fmtNum(s.rows) : '—'}</td>
                  <td className={`px-4 py-2 text-right font-medium ${tone(s.ms)}`}>{fmtMs(s.ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function PerformanceCenter() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [slow, setSlow] = useState<SlowQuery[]>([]);
  const [tables, setTables] = useState<TableStat[]>([]);
  const [indexes, setIndexes] = useState<UnusedIndex[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);
    const [s, t, i] = await Promise.all([
      supabase.rpc('perf_slow_queries' as any, { _limit: 25 }),
      supabase.rpc('perf_table_stats' as any, { _limit: 30 }),
      supabase.rpc('perf_unused_indexes' as any, { _limit: 30 }),
    ]);
    const firstErr = s.error || t.error || i.error;
    if (firstErr) setErr(firstErr.message);
    setSlow((s.data ?? []) as SlowQuery[]);
    setTables((t.data ?? []) as TableStat[]);
    setIndexes((i.data ?? []) as UnusedIndex[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        icon={Gauge}
        title="ALIXWORK Performance Center"
        subtitle="Live-Messung, langsamste Datenbankabfragen und Indexnutzung"
        noBreadcrumbs
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Aktualisieren
          </Button>
        }
      />

      {err && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      <Tabs defaultValue="live" className="w-full">
        <TabsList>
          <TabsTrigger value="live">Live-Messung</TabsTrigger>
          <TabsTrigger value="sql">Langsamste SQL-Abfragen</TabsTrigger>
          <TabsTrigger value="tables">Tabellen &amp; Scans</TabsTrigger>
          <TabsTrigger value="indexes">Ungenutzte Indizes</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4"><LiveTab /></TabsContent>

        <TabsContent value="sql" className="mt-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden card-glow">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-secondary/40 text-muted-foreground text-xs">
                <th className="text-left px-4 py-3 font-medium">Abfrage</th>
                <th className="text-right px-4 py-3 font-medium">Aufrufe</th>
                <th className="text-right px-4 py-3 font-medium">Ø</th>
                <th className="text-right px-4 py-3 font-medium">Max</th>
                <th className="text-right px-4 py-3 font-medium">Gesamt</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
                ) : slow.map((q, idx) => (
                  <tr key={idx} className="align-top">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground max-w-xl">
                      <div className="line-clamp-3 break-all">{q.query}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmtNum(q.calls)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${tone(Number(q.mean_ms))}`}>{fmtMs(q.mean_ms)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmtMs(q.max_ms)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{(Number(q.total_ms) / 1000).toFixed(1)} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="tables" className="mt-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden card-glow">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-secondary/40 text-muted-foreground text-xs">
                <th className="text-left px-4 py-3 font-medium">Tabelle</th>
                <th className="text-right px-4 py-3 font-medium">Datensätze</th>
                <th className="text-right px-4 py-3 font-medium">Größe</th>
                <th className="text-right px-4 py-3 font-medium">Seq-Scans</th>
                <th className="text-right px-4 py-3 font-medium">Index-Scans</th>
                <th className="text-right px-4 py-3 font-medium">Seq-Anteil</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
                ) : tables.map(t => (
                  <tr key={t.table_name}>
                    <td className="px-4 py-3 font-medium text-foreground">{t.table_name}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmtNum(t.live_rows)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{t.total_pretty}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmtNum(t.seq_scans)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmtNum(t.idx_scans)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${Number(t.seq_ratio) > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>{t.seq_ratio}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="indexes" className="mt-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden card-glow">
            <div className="px-4 py-3 border-b border-border bg-secondary/40 text-xs text-muted-foreground flex items-center gap-2">
              <ListTree className="w-3.5 h-3.5" /> Indizes mit weniger als 50 Zugriffen — Kandidaten zum Aufräumen (kosten Schreibleistung).
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-secondary/40 text-muted-foreground text-xs">
                <th className="text-left px-4 py-3 font-medium">Tabelle</th>
                <th className="text-left px-4 py-3 font-medium">Index</th>
                <th className="text-right px-4 py-3 font-medium">Zugriffe</th>
                <th className="text-right px-4 py-3 font-medium">Größe</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={4} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
                ) : indexes.map(i => (
                  <tr key={i.index_name}>
                    <td className="px-4 py-3 text-foreground">{i.table_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{i.index_name}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmtNum(i.index_scans)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{i.index_pretty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
