import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Users, Clock, Zap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Decision = {
  id: string;
  created_at: string;
  chosen_queue_id: string | null;
  chosen_user_id: string | null;
  channel: string | null;
  score: number | null;
  reason: string | null;
  fallback_used: boolean | null;
};
type Queue = { id: string; name: string; strategy: string; enabled: boolean };
type Conv = { id: string; status: string; priority: string; channel_type: string; assigned_to: string | null; last_message_at: string };

export default function RoutingLive() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [presence, setPresence] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [q, d, c, p] = await Promise.all([
      supabase.from("ac_pbx_queues").select("id,name,strategy,enabled").order("name"),
      supabase.from("ac_routing_decisions").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
      supabase.from("ac_conversations").select("id,status,priority,channel_type,assigned_to,last_message_at").in("status", ["open", "pending"]).order("last_message_at", { ascending: false }).limit(100),
      supabase.from("ac_user_presence").select("user_id,status"),
    ]);
    setQueues((q.data ?? []) as Queue[]);
    setDecisions((d.data ?? []) as Decision[]);
    setConvs((c.data ?? []) as Conv[]);
    const map: Record<string, string> = {};
    (p.data ?? []).forEach((r: any) => { map[r.user_id] = r.status; });
    setPresence(map);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("routing-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "ac_routing_decisions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ac_conversations" }, load)
      .subscribe();
    const t = setInterval(load, 15000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, []);

  const online = Object.values(presence).filter((s) => s === "online").length;
  const busy = Object.values(presence).filter((s) => s === "busy").length;
  const unassigned = convs.filter((c) => !c.assigned_to).length;
  const avgScore = decisions.length ? (decisions.reduce((a, d) => a + (d.score ?? 0), 0) / decisions.length).toFixed(2) : "0";

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Routing 2.0 · Live-Dashboard</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Users} label="Agenten online" value={online} sub={`${busy} beschäftigt`} />
        <Kpi icon={Zap} label="Routing-Events / 1h" value={decisions.length} />
        <Kpi icon={Clock} label="Ø Wartezeit" value={`${(avgWait / 1000).toFixed(1)}s`} />
        <Kpi icon={Activity} label="Unassigned" value={unassigned} sub={`${convs.length} offen`} accent={unassigned > 5} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Queues</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {queues.length === 0 && <p className="text-xs text-muted-foreground">Keine Queues konfiguriert.</p>}
            {queues.map((q) => {
              const inQ = decisions.filter((d) => d.queue_id === q.id).length;
              return (
                <div key={q.id} className="flex items-center justify-between text-sm border-b border-border/40 pb-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${q.enabled ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                    <span className="font-medium">{q.name}</span>
                    <Badge variant="outline" className="text-[10px]">{q.strategy}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{inQ} Events / 1h</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Letzte Routing-Entscheidungen</CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-80 overflow-auto">
            {decisions.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Events.</p>}
            {decisions.slice(0, 20).map((d) => (
              <div key={d.id} className="text-xs flex items-center justify-between border-b border-border/40 py-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-mono">{new Date(d.created_at).toLocaleTimeString("de-DE")}</span>
                  <Badge variant="outline" className="text-[10px]">{d.strategy ?? "—"}</Badge>
                  {d.agent_id && <span className="font-mono">{d.agent_id.slice(0, 8)}</span>}
                </div>
                <span className="text-muted-foreground truncate max-w-[50%]">{d.reason ?? "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Offene Konversationen ({convs.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 max-h-80 overflow-auto">
          {convs.slice(0, 30).map((c) => {
            const age = Date.now() - new Date(c.last_message_at).getTime();
            const mins = Math.round(age / 60000);
            const sla = mins > 15;
            return (
              <div key={c.id} className="text-xs flex items-center justify-between border-b border-border/40 py-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{c.channel_type}</Badge>
                  <Badge variant={c.priority === "urgent" ? "destructive" : "secondary"} className="text-[10px]">{c.priority}</Badge>
                  <span className={c.assigned_to ? "" : "text-amber-500"}>{c.assigned_to ? `→ ${c.assigned_to.slice(0, 8)}` : "unassigned"}</span>
                </div>
                <span className={sla ? "text-destructive font-medium" : "text-muted-foreground"}>{mins}m alt {sla && "⚠"}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: any; sub?: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-amber-500/50" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
