import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Save, Route as RouteIcon, Activity, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type SimResult = {
  matched_rule_id: string | null;
  matched_rule_name: string | null;
  assigned_agent_id: string | null;
  eligible_agents: string[];
  queue_id: string | null;
  sla: { first_response_sec: number; resolution_sec: number } | null;
  fallback_used: boolean;
  customer_score: number;
  trace: Array<{ rule_id: string; name: string; result: 'skip'|'match'; reason: string }>;
};

export default function RoutingSimulator() {
  const [channel, setChannel] = useState<string>("chat");
  const [language, setLanguage] = useState("");
  const [skills, setSkills] = useState("");
  const [score, setScore] = useState<string>("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [heatmap, setHeatmap] = useState<Record<string, Record<number, number>>>({});

  async function loadHistory() {
    const { data } = await supabase.from("ac_routing_simulations")
      .select("id, name, matched_rule_id, assigned_agent_id, result, created_at")
      .order("created_at", { ascending: false }).limit(15);
    setHistory(data ?? []);
  }
  async function loadHeatmap() {
    const since = new Date(Date.now() - 7*86400_000).toISOString();
    const { data } = await supabase.from("ac_routing_decisions")
      .select("rule_id, created_at").gte("created_at", since).limit(2000);
    const map: Record<string, Record<number, number>> = {};
    (data ?? []).forEach((d: any) => {
      const key = d.rule_id ?? "fallback";
      const h = new Date(d.created_at).getUTCHours();
      map[key] ??= {}; map[key][h] = (map[key][h] ?? 0) + 1;
    });
    setHeatmap(map);
  }
  useEffect(() => { loadHistory(); loadHeatmap(); }, []);

  const maxCell = useMemo(() => {
    let m = 0;
    for (const r of Object.values(heatmap)) for (const v of Object.values(r)) m = Math.max(m, v);
    return m || 1;
  }, [heatmap]);

  async function run(save: boolean) {
    setLoading(true);
    try {
      const payload: any = { channel, save };
      if (name) payload.name = name;
      if (language) payload.language = language;
      if (skills) payload.required_skills = skills.split(",").map((s) => s.trim()).filter(Boolean);
      if (score) payload.customer_score = Number(score);
      const { data, error } = await supabase.functions.invoke("ac-router-simulate", { body: payload });
      if (error) throw error;
      setResult(data);
      if (save) { toast.success("Simulation gespeichert"); loadHistory(); }
    } catch (e: any) {
      toast.error(e?.message ?? "Simulation fehlgeschlagen");
    } finally { setLoading(false); }
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <RouteIcon className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Routing Simulator &amp; Live-Heatmap</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Testfall</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Kanal</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["call","chat","email","whatsapp","sms","ticket"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Sprache</Label><Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="de / en / …" /></div>
              <div><Label>Skills (kommagetrennt)</Label><Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="reklamation, at" /></div>
              <div><Label>Customer Score</Label><Input type="number" value={score} onChange={(e) => setScore(e.target.value)} /></div>
              <div className="col-span-2"><Label>Name (optional, für Speichern)</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={() => run(false)} disabled={loading}><Play className="h-4 w-4 mr-1" />Simulieren</Button>
              <Button variant="secondary" onClick={() => run(true)} disabled={loading}><Save className="h-4 w-4 mr-1" />Speichern</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Ergebnis</CardTitle></CardHeader>
          <CardContent>
            {!result ? <p className="text-xs text-muted-foreground">Noch keine Simulation.</p> : (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  {result.fallback_used
                    ? <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Fallback</Badge>
                    : <Badge className="bg-primary text-primary-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Match</Badge>}
                  <span className="font-medium">{result.matched_rule_name ?? "— keine passende Regel —"}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Agent: <span className="text-foreground">{result.assigned_agent_id ?? "—"}</span> · Queue: <span className="text-foreground">{result.queue_id ?? "—"}</span> · Score: <span className="text-foreground">{result.customer_score}</span>
                </div>
                {result.sla && (
                  <div className="text-xs">SLA: erste Antwort {result.sla.first_response_sec}s · Lösung {result.sla.resolution_sec}s</div>
                )}
                <div>
                  <div className="text-xs font-medium mb-1">Trace</div>
                  <div className="space-y-1 max-h-56 overflow-auto">
                    {result.trace.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        {t.result === "match"
                          ? <CheckCircle2 className="h-3 w-3 mt-0.5 text-primary" />
                          : <XCircle className="h-3 w-3 mt-0.5 text-muted-foreground" />}
                        <div><span className="font-medium">{t.name}</span> — <span className="text-muted-foreground">{t.reason}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Live-Heatmap (7 Tage · UTC)</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(heatmap).length === 0 ? <p className="text-xs text-muted-foreground">Noch keine Routing-Decisions.</p> : (
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead><tr><th className="text-left p-1">Regel</th>{Array.from({length:24}).map((_,h)=><th key={h} className="p-1 w-6 text-center text-[10px]">{h}</th>)}</tr></thead>
                <tbody>
                  {Object.entries(heatmap).map(([rid, row]) => (
                    <tr key={rid}>
                      <td className="p-1 pr-3 font-mono text-[10px]">{rid.slice(0,8)}</td>
                      {Array.from({length:24}).map((_,h)=>{
                        const v = row[h] ?? 0;
                        const alpha = v / maxCell;
                        return <td key={h} className="p-0.5"><div className="h-5 w-5 rounded" style={{ backgroundColor: `hsl(var(--primary) / ${alpha})` }} title={`${v} Decisions`} /></td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Gespeicherte Simulationen</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? <p className="text-xs text-muted-foreground">Keine Einträge.</p> : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between border border-border/60 rounded p-2 text-xs">
                  <div>
                    <div className="font-medium">{h.name}</div>
                    <div className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div>Regel: <span className="font-mono">{h.matched_rule_id?.slice(0,8) ?? "—"}</span></div>
                    <div>Agent: <span className="font-mono">{h.assigned_agent_id?.slice(0,8) ?? "—"}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
