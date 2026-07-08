import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { eig } from "@/lib/eig/store";

const Row = ({ label, value, tone = "ok" as "ok" | "warn" | "err" }) => {
  const c = tone === "ok" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : "text-red-400";
  return <div className="flex items-center justify-between py-1.5 text-sm border-b border-border/30"><span className="text-muted-foreground">{label}</span><span className={c}>{value}</span></div>;
};

export default function Monitoring() {
  const events = eig.events.list();
  const failed = events.filter(e => e.status === "failed").length;
  const avg = events.length ? Math.round(events.reduce((s, e) => s + e.latencyMs, 0) / events.length) : 0;
  const p95 = events.length ? [...events].sort((a, b) => a.latencyMs - b.latencyMs)[Math.floor(events.length * 0.95)]?.latencyMs ?? 0 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Monitoring</h1>
        <p className="text-sm text-muted-foreground mt-1">API · Queues · Fehler · Sync · Import · Export · Workflow</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Antwortzeiten & Fehler</CardTitle></CardHeader>
          <CardContent>
            <Row label="Events insgesamt" value={String(events.length)} />
            <Row label="Fehler" value={String(failed)} tone={failed > 0 ? "warn" : "ok"} />
            <Row label="⌀ Latenz" value={`${avg} ms`} />
            <Row label="Latenz p95" value={`${p95} ms`} tone={p95 > 300 ? "warn" : "ok"} />
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Queues & Jobs</CardTitle></CardHeader>
          <CardContent>
            {eig.list("queues").map(q => <Row key={q.id} label={`${q.name} (${q.type})`} value={`Backlog: ${q.depth}`} tone={q.depth > 0 && q.type === "dead-letter" ? "err" : q.depth > 10 ? "warn" : "ok"} />)}
            <Row label="Aktive Hintergrundjobs" value={String(eig.list("jobs").length)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
