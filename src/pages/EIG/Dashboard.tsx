import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { eig } from "@/lib/eig/store";
import { Cable, Radio, Workflow, Plug, Timer, Puzzle, Activity, Webhook, Bug } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Kpi = ({ icon: Icon, label, value, tone = "amber" }: any) => (
  <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg bg-gradient-to-br from-${tone}-400/20 to-${tone}-500/10 flex items-center justify-center`}>
        <Icon className={`h-5 w-5 text-${tone}-300`} />
      </div>
      <div>
        <div className="text-xs uppercase text-muted-foreground tracking-wider">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </div>
    </CardContent>
  </Card>
);

const StatusRow = ({ label, status = "ok" as "ok" | "warn" | "err" }) => {
  const color = status === "ok" ? "bg-emerald-500" : status === "warn" ? "bg-amber-500" : "bg-red-500";
  const text = status === "ok" ? "online" : status === "warn" ? "degradiert" : "offline";
  return (
    <div className="flex items-center justify-between py-1.5 text-sm border-b border-border/30">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${color}`} />{text}</span>
    </div>
  );
};

export default function EigDashboard() {
  const events = eig.events.list();
  const delivered = events.filter(e => e.status === "delivered").length;
  const failed = events.filter(e => e.status === "failed").length;
  const avgLatency = events.length ? Math.round(events.reduce((s, e) => s + e.latencyMs, 0) / events.length) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Integration Cockpit</h1>
        <p className="text-sm text-muted-foreground mt-1">Zentraler Systemstatus des Enterprise Integration Gateway.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi icon={Cable} label="APIs" value={eig.list("apis").length} />
        <Kpi icon={Radio} label="Events" value={eig.list("events").length} />
        <Kpi icon={Workflow} label="Workflows" value={eig.list("workflows").length} />
        <Kpi icon={Plug} label="Integrationen" value={eig.list("integrations").length} />
        <Kpi icon={Timer} label="Jobs" value={eig.list("jobs").length} />
        <Kpi icon={Webhook} label="Webhooks" value={eig.list("webhooks").length} />
        <Kpi icon={Puzzle} label="Plugins" value={eig.list("plugins").length} />
        <Kpi icon={Activity} label="⌀ Latenz" value={`${avgLatency} ms`} />
        <Kpi icon={Radio} label="Zugestellt" value={delivered} />
        <Kpi icon={Bug} label="Fehler (Events)" value={failed} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Ampelsystem – Dienste</CardTitle></CardHeader>
          <CardContent>
            <StatusRow label="REST API Gateway" />
            <StatusRow label="Event Bus" />
            <StatusRow label="Workflow Engine" />
            <StatusRow label="Job Queue" />
            <StatusRow label="Retry / DLQ" status="warn" />
            <StatusRow label="OpenAPI Doku" />
            <StatusRow label="SSO (vorbereitet)" status="warn" />
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Letzte Events</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
                <tr><th className="text-left px-4 py-2">Zeit</th><th className="text-left px-4 py-2">Event</th><th className="text-left px-4 py-2">Modul</th><th className="text-left px-4 py-2">Status</th></tr>
              </thead>
              <tbody>
                {events.slice(0, 10).map(e => (
                  <tr key={e.id} className="border-b border-border/30">
                    <td className="px-4 py-2 text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</td>
                    <td className="px-4 py-2">{e.event}</td>
                    <td className="px-4 py-2">{e.module}</td>
                    <td className="px-4 py-2"><Badge variant={e.status === "delivered" ? "default" : "destructive"}>{e.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
