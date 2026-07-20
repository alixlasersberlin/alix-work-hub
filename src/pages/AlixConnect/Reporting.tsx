import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileBarChart, Download, MessageSquare, Clock, Users, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";

type ChannelRow = { channel: string; messages: number; conversations: number; avg_first_reply_min: number };
type DayRow = { day: string; inbound: number; outbound: number };
type HeatCell = { dow: number; hour: number; count: number };
type AgentRow = { user_id: string; name: string; replies: number; avg_reply_min: number };

const COLORS = ["hsl(var(--primary))", "#22c55e", "#eab308", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];
const DOW = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export default function AlixConnectReporting() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [channelRows, setChannelRows] = useState<ChannelRow[]>([]);
  const [daySeries, setDaySeries] = useState<DayRow[]>([]);
  const [heat, setHeat] = useState<HeatCell[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [totals, setTotals] = useState({ msgs: 0, convs: 0, avgFrt: 0, activeAgents: 0 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - days * 86400000).toISOString();

      const [convRes, msgRes, profRes] = await Promise.all([
        supabase.from("ac_conversations").select("id, channel_type, created_at").gte("created_at", since),
        supabase.from("ac_messages")
          .select("id, conversation_id, direction, created_at, sender_user_id, is_internal_note")
          .gte("created_at", since),
        supabase.from("user_profiles").select("id, first_name, last_name, email"),
      ]);
      const convs = convRes.data ?? [];
      const msgs = (msgRes.data ?? []).filter((m: any) => !m.is_internal_note);
      const profs = new Map((profRes.data ?? []).map((p: any) => [p.id, p]));
      const convMap = new Map(convs.map((c: any) => [c.id, c]));

      // ── Channels
      const byChannel: Record<string, { c: number; m: number; frt: number[] }> = {};
      convs.forEach((c: any) => {
        const k = c.channel_type || "unknown";
        byChannel[k] ||= { c: 0, m: 0, frt: [] };
        byChannel[k].c++;
      });
      const firstIn: Record<string, number> = {};
      const firstOut: Record<string, number> = {};

      // ── Days + heat
      const dayMap = new Map<string, DayRow>();
      const heatMap = new Map<string, HeatCell>();
      // ── Agents
      const agentMap = new Map<string, { replies: number; times: number[] }>();

      msgs.forEach((m: any) => {
        const c = convMap.get(m.conversation_id) as any;
        const k = c?.channel_type || "unknown";
        byChannel[k] ||= { c: 0, m: 0, frt: [] };
        byChannel[k].m++;

        const d = new Date(m.created_at);
        const day = d.toISOString().slice(0, 10);
        const row = dayMap.get(day) ?? { day, inbound: 0, outbound: 0 };
        if (m.direction === "inbound") row.inbound++;
        else row.outbound++;
        dayMap.set(day, row);

        const key = `${d.getDay()}-${d.getHours()}`;
        const cell = heatMap.get(key) ?? { dow: d.getDay(), hour: d.getHours(), count: 0 };
        cell.count++;
        heatMap.set(key, cell);

        const t = d.getTime();
        if (m.direction === "inbound" && (!firstIn[m.conversation_id] || t < firstIn[m.conversation_id])) firstIn[m.conversation_id] = t;
        if (m.direction === "outbound") {
          if (!firstOut[m.conversation_id] || t < firstOut[m.conversation_id]) firstOut[m.conversation_id] = t;
          if (m.sender_user_id) {
            const a = agentMap.get(m.sender_user_id) ?? { replies: 0, times: [] };
            a.replies++;
            agentMap.set(m.sender_user_id, a);
          }
        }
      });

      const frtAll: number[] = [];
      Object.keys(firstIn).forEach((cid) => {
        if (firstOut[cid] && firstOut[cid] > firstIn[cid]) {
          const diff = (firstOut[cid] - firstIn[cid]) / 60000;
          frtAll.push(diff);
          const c = convMap.get(cid) as any;
          const k = c?.channel_type || "unknown";
          byChannel[k]?.frt.push(diff);
        }
      });

      // Agents avg reply time = per conversation their first outbound minus first inbound (when they replied)
      msgs.forEach((m: any) => {
        if (m.direction !== "outbound" || !m.sender_user_id) return;
        const fi = firstIn[m.conversation_id];
        if (!fi) return;
        const t = new Date(m.created_at).getTime();
        if (t < fi) return;
        const a = agentMap.get(m.sender_user_id);
        if (a) a.times.push((t - fi) / 60000);
      });

      setChannelRows(
        Object.entries(byChannel).map(([channel, v]) => ({
          channel,
          conversations: v.c,
          messages: v.m,
          avg_first_reply_min: v.frt.length ? Math.round(v.frt.reduce((a, b) => a + b, 0) / v.frt.length) : 0,
        })).sort((a, b) => b.messages - a.messages),
      );

      setDaySeries(
        Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day)),
      );
      setHeat(Array.from(heatMap.values()));

      setAgents(
        Array.from(agentMap.entries()).map(([uid, v]) => {
          const p = profs.get(uid) as any;
          const name = p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email : uid.slice(0, 8);
          return {
            user_id: uid,
            name,
            replies: v.replies,
            avg_reply_min: v.times.length ? Math.round(v.times.reduce((a, b) => a + b, 0) / v.times.length) : 0,
          };
        }).sort((a, b) => b.replies - a.replies).slice(0, 10),
      );

      setTotals({
        msgs: msgs.length,
        convs: convs.length,
        avgFrt: frtAll.length ? Math.round(frtAll.reduce((a, b) => a + b, 0) / frtAll.length) : 0,
        activeAgents: agentMap.size,
      });
      setLoading(false);
    })();
  }, [days]);

  const maxHeat = useMemo(() => Math.max(1, ...heat.map((h) => h.count)), [heat]);

  const exportCsv = () => {
    const header = "channel,conversations,messages,avg_first_reply_min\n";
    const body = channelRows.map((r) => `${r.channel},${r.conversations},${r.messages},${r.avg_first_reply_min}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `alix-connect-report-${days}d.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-primary" /> Reporting &amp; BI
            <Badge variant="default" className="ml-2">Live</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">Volumen, SLA-Heatmap, Kanal-Vergleich und Agent-Performance der letzten {days} Tage.</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
            <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>{d}T</Button>
          ))}
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={channelRows.length === 0}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: "Nachrichten", v: totals.msgs, i: MessageSquare },
          { l: "Konversationen", v: totals.convs, i: TrendingUp },
          { l: "Ø First-Reply", v: totals.avgFrt ? `${totals.avgFrt} min` : "—", i: Clock },
          { l: "Aktive Agenten", v: totals.activeAgents, i: Users },
        ].map((k) => (
          <Card key={k.l} className="p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <k.i className="h-3.5 w-3.5" /> {k.l}
            </div>
            <div className="text-2xl font-semibold mt-1">{loading ? "…" : k.v}</div>
          </Card>
        ))}
      </div>

      {/* Volume over time */}
      <Card className="p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Nachrichtenvolumen</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="inbound" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Eingehend" />
              <Line type="monotone" dataKey="outbound" stroke="#22c55e" strokeWidth={2} dot={false} name="Ausgehend" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Channel bar */}
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Kanal-Vergleich</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="messages" fill="hsl(var(--primary))" name="Nachrichten" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Channel share pie */}
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Kanal-Verteilung</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={channelRows} dataKey="conversations" nameKey="channel" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {channelRows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* SLA Heatmap */}
      <Card className="p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          SLA-Heatmap · Nachrichten nach Wochentag &amp; Stunde
        </div>
        <div className="overflow-x-auto">
          <table className="text-[10px] w-full">
            <thead>
              <tr>
                <th className="w-8"></th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h} className="text-center text-muted-foreground font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DOW.map((d, dow) => (
                <tr key={d}>
                  <td className="text-muted-foreground pr-2 font-medium">{d}</td>
                  {Array.from({ length: 24 }, (_, h) => {
                    const cell = heat.find((x) => x.dow === dow && x.hour === h);
                    const intensity = cell ? cell.count / maxHeat : 0;
                    return (
                      <td key={h} className="p-0.5">
                        <div
                          className="h-6 rounded-sm border border-border/40"
                          style={{ background: intensity > 0 ? `hsl(var(--primary) / ${0.15 + intensity * 0.85})` : "hsl(var(--muted) / 0.3)" }}
                          title={cell ? `${d} ${h}:00 · ${cell.count}` : `${d} ${h}:00`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Agents */}
      <Card className="p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Top Agenten (Antworten)</div>
        {agents.length === 0 ? (
          <div className="text-sm text-muted-foreground">Keine Agent-Aktivität im Zeitraum.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-2">Agent</th>
                <th className="text-right p-2">Antworten</th>
                <th className="text-right p-2">Ø Reply (min)</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.user_id} className="border-t border-border/60">
                  <td className="p-2 font-medium">{a.name}</td>
                  <td className="p-2 text-right">{a.replies}</td>
                  <td className="p-2 text-right">{a.avg_reply_min || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Channel table */}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Kanal</th>
              <th className="text-right p-3">Konversationen</th>
              <th className="text-right p-3">Nachrichten</th>
              <th className="text-right p-3">Ø First-Reply (min)</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Lade…</td></tr>}
            {!loading && channelRows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Keine Daten im Zeitraum.</td></tr>}
            {channelRows.map((r) => (
              <tr key={r.channel} className="border-t border-border/60">
                <td className="p-3 font-medium">{r.channel}</td>
                <td className="p-3 text-right">{r.conversations}</td>
                <td className="p-3 text-right">{r.messages}</td>
                <td className="p-3 text-right">{r.avg_first_reply_min || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
