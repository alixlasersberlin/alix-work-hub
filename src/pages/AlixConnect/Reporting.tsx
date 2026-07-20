import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileBarChart, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = { channel: string; messages: number; conversations: number; avg_first_reply_min: number };

export default function AlixConnectReporting() {
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data: convs } = await supabase
        .from("ac_conversations")
        .select("id, channel_type, created_at")
        .gte("created_at", since);
      const { data: msgs } = await supabase
        .from("ac_messages")
        .select("id, conversation_id, direction, created_at")
        .gte("created_at", since);

      const byChannel: Record<string, { c: number; m: number; frt: number[] }> = {};
      const convMap = new Map((convs ?? []).map((c: any) => [c.id, c]));
      (convs ?? []).forEach((c: any) => {
        const k = c.channel_type || "unknown";
        byChannel[k] ||= { c: 0, m: 0, frt: [] };
        byChannel[k].c++;
      });
      // group first outbound reply time per conversation
      const firstIn: Record<string, number> = {};
      const firstOut: Record<string, number> = {};
      (msgs ?? []).forEach((m: any) => {
        const c = convMap.get(m.conversation_id) as any;
        if (!c) return;
        const k = c.channel_type || "unknown";
        byChannel[k] ||= { c: 0, m: 0, frt: [] };
        byChannel[k].m++;
        const t = new Date(m.created_at).getTime();
        if (m.direction === "inbound" && (!firstIn[m.conversation_id] || t < firstIn[m.conversation_id])) firstIn[m.conversation_id] = t;
        if (m.direction === "outbound" && (!firstOut[m.conversation_id] || t < firstOut[m.conversation_id])) firstOut[m.conversation_id] = t;
      });
      Object.keys(firstIn).forEach((cid) => {
        if (firstOut[cid] && firstOut[cid] > firstIn[cid]) {
          const c = convMap.get(cid) as any;
          const k = c?.channel_type || "unknown";
          byChannel[k]?.frt.push((firstOut[cid] - firstIn[cid]) / 60000);
        }
      });

      const out: Row[] = Object.entries(byChannel).map(([channel, v]) => ({
        channel,
        conversations: v.c,
        messages: v.m,
        avg_first_reply_min: v.frt.length ? Math.round(v.frt.reduce((a, b) => a + b, 0) / v.frt.length) : 0,
      })).sort((a, b) => b.messages - a.messages);
      setRows(out);
      setLoading(false);
    })();
  }, [days]);

  const exportCsv = () => {
    const header = "channel,conversations,messages,avg_first_reply_min\n";
    const body = rows.map((r) => `${r.channel},${r.conversations},${r.messages},${r.avg_first_reply_min}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alix-connect-report-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-primary" /> Reporting &amp; BI
            <Badge variant="outline" className="ml-2">Phase 8</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">Response-Zeiten, Volumen und Kanal-Vergleich der letzten {days} Tage.</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
            <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>{d}T</Button>
          ))}
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

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
            {!loading && rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Keine Daten im Zeitraum.</td></tr>}
            {rows.map((r) => (
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
