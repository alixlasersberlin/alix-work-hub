import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, MessageSquare, AlertTriangle, BookOpen, Loader2 } from "lucide-react";

type Conv = { id: string; subject: string | null; channel_type: string | null; status: string | null; last_message_at: string | null };

export default function AgentAssistLive() {
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [active, setActive] = useState<Conv | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ac_conversations")
        .select("id, subject, channel_type, status, last_message_at")
        .in("status", ["open", "pending"] as any)
        .order("last_message_at", { ascending: false })
        .limit(50);
      setConversations((data ?? []) as any);
    })();
  }, []);

  const analyze = async (conv: Conv) => {
    setActive(conv);
    setLoading(true);
    setResult(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("ac-agent-assist-live", {
        body: { conversation_id: conv.id, agent_user_id: u.user?.id },
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      toast.error(e.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  };

  const urgencyColor = (u?: string) => u === "high" ? "destructive" : u === "medium" ? "default" : "secondary";
  const sentColor = (s?: string) => s === "negativ" ? "destructive" : s === "positiv" ? "default" : "secondary";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Agent Assist Live 2.0</h1>
        <Badge variant="outline">Phase 33</Badge>
      </div>
      <p className="text-sm text-muted-foreground">Echtzeit Next-Best-Action, KB-Snippets und Sentiment-Warnungen für laufende Konversationen.</p>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Offene Konversationen</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-[70vh] overflow-y-auto">
            {conversations.length === 0 && <div className="p-4 text-sm text-muted-foreground">Keine offenen Konversationen.</div>}
            {conversations.map((c) => (
              <button key={c.id} onClick={() => analyze(c)}
                className={`w-full text-left p-3 border-b border-border/50 hover:bg-muted/50 ${active?.id === c.id ? "bg-muted" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{c.subject || "(ohne Betreff)"}</span>
                  <Badge variant="outline" className="text-[10px]">{c.channel}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{c.last_message_at ? new Date(c.last_message_at).toLocaleString("de-DE") : "—"}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Live-Copilot</CardTitle>
            {active && <Button size="sm" variant="outline" onClick={() => analyze(active)} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Neu analysieren"}</Button>}
          </CardHeader>
          <CardContent className="space-y-4">
            {!active && <div className="text-sm text-muted-foreground">Konversation links wählen…</div>}
            {loading && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> AI analysiert…</div>}
            {result && !loading && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {result.sentiment && <Badge variant={sentColor(result.sentiment) as any}>Sentiment: {result.sentiment}</Badge>}
                  {result.urgency && <Badge variant={urgencyColor(result.urgency) as any}>Dringlichkeit: {result.urgency}</Badge>}
                  {result.tone && <Badge variant="outline">Tonalität: {result.tone}</Badge>}
                  <Badge variant="outline">KB-Treffer: {result.kb_count ?? 0}</Badge>
                </div>
                {result.urgency === "high" && (
                  <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                    <span>Hohe Dringlichkeit erkannt — bitte priorisieren.</span>
                  </div>
                )}
                {result.next_reply && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase"><MessageSquare className="h-3 w-3" /> Vorgeschlagene Antwort</div>
                    <div className="rounded border bg-card/50 p-3 text-sm whitespace-pre-wrap">{result.next_reply}</div>
                    <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(result.next_reply); toast.success("Kopiert"); }}>Kopieren</Button>
                  </div>
                )}
                {result.kb_snippet && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase"><BookOpen className="h-3 w-3" /> KB-Snippet</div>
                    <div className="rounded border bg-card/50 p-3 text-sm whitespace-pre-wrap">{result.kb_snippet}</div>
                  </div>
                )}
                {Array.isArray(result.actions) && result.actions.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase mb-1">Empfohlene Aktionen</div>
                    <ul className="list-disc list-inside text-sm space-y-1">{result.actions.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
