import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bot, CheckCircle2, AlertTriangle, Loader2, Play } from "lucide-react";

type Ticket = { id: string; subject: string | null; status: string; priority: string; created_at: string };

export default function AutonomousAgents() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<Ticket | null>(null);
  const [proposal, setProposal] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [autoMode, setAutoMode] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("tickets")
      .select("id, subject, status, priority, created_at")
      .in("status", ["new", "open"])
      .order("created_at", { ascending: false }).limit(50);
    setTickets(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const propose = async (t: Ticket) => {
    setActive(t); setLoading(true); setProposal(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("ac-autonomous-resolve", {
        body: { ticket_id: t.id, mode: "propose", executor_user_id: u.user?.id },
      });
      if (error) throw error;
      setProposal(data);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const execute = async () => {
    if (!active) return;
    setExecuting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("ac-autonomous-resolve", {
        body: { ticket_id: active.id, mode: "execute", executor_user_id: u.user?.id },
      });
      if (error) throw error;
      if (data.needs_approval) {
        toast.warning("Freigabe erforderlich — Vertrauen zu gering.");
      } else {
        toast.success(`${(data.executed ?? []).filter((e: any) => e.ok).length} Aktionen ausgeführt`);
        await load();
        setActive(null); setProposal(null);
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setExecuting(false); }
  };

  const catColor = (c: string) => c === "complex" ? "destructive" : c === "info" ? "secondary" : "default";
  const confidenceOk = (p: any) => p?.resolvable && Number(p?.confidence ?? 0) >= 0.85;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Autonomous Service Agents</h1>
        <Badge variant="outline">Phase 33</Badge>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={autoMode} onChange={(e) => setAutoMode(e.target.checked)} />
          Auto-Execute (Confidence ≥ 85%)
        </label>
      </div>
      <p className="text-sm text-muted-foreground">AI-Agenten lösen einfache Tickets autonom (Statusabfrage, Info, Refund-Check) mit Freigabe-Workflow.</p>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Offene Tickets</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-[70vh] overflow-y-auto">
            {tickets.length === 0 && <div className="p-4 text-sm text-muted-foreground">Keine offenen Tickets.</div>}
            {tickets.map((t) => (
              <button key={t.id} onClick={() => propose(t)}
                className={`w-full text-left p-3 border-b border-border/50 hover:bg-muted/50 ${active?.id === t.id ? "bg-muted" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{t.subject || "(kein Betreff)"}</span>
                  <Badge variant="outline" className="text-[10px]">{t.priority || "normal"}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{new Date(t.created_at).toLocaleString("de-DE")}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">AI-Vorschlag</CardTitle>
            {proposal && (
              <Button size="sm" onClick={execute} disabled={executing || (!autoMode && !confidenceOk(proposal.proposal))}>
                {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 mr-1" /> Ausführen</>}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {!active && <div className="text-sm text-muted-foreground">Ticket links wählen…</div>}
            {loading && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> AI prüft…</div>}
            {proposal && !loading && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={proposal.proposal?.resolvable ? "default" : "destructive"}>
                    {proposal.proposal?.resolvable ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                    {proposal.proposal?.resolvable ? "Auto-lösbar" : "Human Handoff"}
                  </Badge>
                  <Badge variant={catColor(proposal.proposal?.category) as any}>{proposal.proposal?.category}</Badge>
                  <Badge variant="outline">Confidence: {Math.round((proposal.proposal?.confidence ?? 0) * 100)}%</Badge>
                </div>
                {proposal.proposal?.proposed_reply && (
                  <div className="rounded border bg-card/50 p-3 text-sm whitespace-pre-wrap">{proposal.proposal.proposed_reply}</div>
                )}
                {Array.isArray(proposal.proposal?.proposed_actions) && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Aktionen</div>
                    <ul className="list-disc list-inside text-sm">
                      {proposal.proposal.proposed_actions.map((a: any, i: number) => <li key={i}><code>{a.kind}</code> {a.payload && <span className="text-muted-foreground">— {JSON.stringify(a.payload)}</span>}</li>)}
                    </ul>
                  </div>
                )}
                {proposal.proposal?.reasoning && <div className="text-xs text-muted-foreground italic">{proposal.proposal.reasoning}</div>}
                {!confidenceOk(proposal.proposal) && !autoMode && (
                  <div className="text-xs text-amber-500">Confidence &lt; 85% oder nicht lösbar — Freigabe/Auto-Modus erforderlich.</div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
