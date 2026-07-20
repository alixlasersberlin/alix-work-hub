import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Plus, Trash2, PlayCircle, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Rule = {
  id: string;
  name: string;
  trigger: "message.received" | "conversation.created" | "sla.breached" | "keyword.matched";
  channel: string;
  keyword: string | null;
  action: "assign" | "tag" | "auto_reply" | "ai_reply" | "escalate" | "webhook";
  action_value: string;
  active: boolean;
  run_count: number;
  last_run_at: string | null;
};

type Run = {
  id: string;
  rule_id: string;
  action: string;
  status: string;
  details: any;
  created_at: string;
};

type Draft = {
  name: string;
  trigger: Rule["trigger"];
  channel: string;
  keyword: string;
  action: Rule["action"];
  action_value: string;
  active: boolean;
};
const emptyDraft: Draft = {
  name: "",
  trigger: "message.received",
  channel: "any",
  keyword: "",
  action: "auto_reply",
  action_value: "",
  active: true,
};

export default function AlixConnectAutomation() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [draft, setDraft] = useState<typeof emptyDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [r, l] = await Promise.all([
      supabase.from("ac_automation_rules").select("*").order("created_at", { ascending: false }),
      supabase.from("ac_automation_runs").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    if (r.error) toast.error("Regeln laden fehlgeschlagen: " + r.error.message);
    setRules((r.data as any) ?? []);
    setRuns((l.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!draft.name.trim() || !draft.action_value.trim()) {
      toast.error("Name und Aktion erforderlich");
      return;
    }
    const { error } = await supabase.from("ac_automation_rules").insert({
      name: draft.name,
      trigger: draft.trigger,
      channel: draft.channel,
      keyword: draft.trigger === "keyword.matched" ? draft.keyword : null,
      action: draft.action,
      action_value: draft.action_value,
      active: draft.active,
    });
    if (error) { toast.error(error.message); return; }
    setDraft(emptyDraft);
    toast.success("Regel gespeichert");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("ac_automation_rules").delete().eq("id", id);
    load();
  };

  const toggle = async (r: Rule) => {
    await supabase.from("ac_automation_rules").update({ active: !r.active }).eq("id", r.id);
    load();
  };

  const test = async (r: Rule) => {
    const { error } = await supabase.functions.invoke("ac-automation-run", {
      body: {
        event: r.trigger,
        body: r.keyword || "TEST",
        conversation_id: null,
        message_id: null,
      },
    });
    if (error) toast.error("Test fehlgeschlagen: " + error.message);
    else { toast.success("Test ausgeführt"); load(); }
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Automation &amp; Workflows
          <Badge variant="default" className="ml-2">Server-Engine live</Badge>
        </h2>
        <p className="text-sm text-muted-foreground">
          Regeln laufen serverseitig via Postgres-Trigger + Edge Function. Alle eingehenden Kundennachrichten werden geprüft.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Neue Regel</div>
        <div className="grid md:grid-cols-2 gap-3">
          <Input placeholder="Regelname (z.B. Preisanfrage Auto-Reply)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={draft.trigger} onValueChange={(v: any) => setDraft({ ...draft, trigger: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="message.received">Nachricht empfangen</SelectItem>
                <SelectItem value="conversation.created">Neue Konversation</SelectItem>
                <SelectItem value="sla.breached">SLA überschritten</SelectItem>
                <SelectItem value="keyword.matched">Keyword erkannt</SelectItem>
              </SelectContent>
            </Select>
            <Select value={draft.channel} onValueChange={(v: any) => setDraft({ ...draft, channel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Alle Kanäle</SelectItem>
                <SelectItem value="website_chat">Website</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">E-Mail</SelectItem>
                <SelectItem value="messenger">Messenger</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {draft.trigger === "keyword.matched" && (
          <Input placeholder="Keyword (z.B. Preis, Rechnung, Reklamation)" value={draft.keyword} onChange={(e) => setDraft({ ...draft, keyword: e.target.value })} />
        )}
        <div className="grid md:grid-cols-[220px_1fr] gap-2">
          <Select value={draft.action} onValueChange={(v: any) => setDraft({ ...draft, action: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto_reply">Auto-Antwort senden</SelectItem>
              <SelectItem value="ai_reply">✨ KI-Antwort (Gemini)</SelectItem>
              <SelectItem value="assign">Zuweisen an User (E-Mail)</SelectItem>
              <SelectItem value="tag">Tag hinzufügen</SelectItem>
              <SelectItem value="escalate">Priorität = hoch</SelectItem>
              <SelectItem value="webhook">Webhook URL aufrufen</SelectItem>
            </SelectContent>
          </Select>
          <Textarea rows={2} placeholder={
            draft.action === "auto_reply" ? "Antworttext…"
              : draft.action === "ai_reply" ? "Optionaler System-Prompt (leer = Standard-Kundenservice-Prompt)"
              : draft.action === "webhook" ? "https://…"
              : draft.action === "assign" ? "user@alix-operation.de"
              : "Wert…"
          } value={draft.action_value} onChange={(e) => setDraft({ ...draft, action_value: e.target.value })} />
        </div>
        <div className="flex justify-end">
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> Regel speichern</Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Regeln ({rules.length}) {loading && "…"}
        </div>
        {rules.length === 0 ? (
          <div className="text-sm text-muted-foreground">Noch keine Regeln definiert.</div>
        ) : (
          <div className="space-y-2">
            {rules.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded border border-border/60 p-3">
                <Switch checked={r.active} onCheckedChange={() => toggle(r)} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {r.trigger} · {r.channel}{r.keyword ? ` · "${r.keyword}"` : ""} → {r.action}: {r.action_value}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {r.run_count} Ausführungen{r.last_run_at ? ` · letzte ${new Date(r.last_run_at).toLocaleString("de-DE")}` : ""}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => test(r)} title="Testen">
                  <PlayCircle className="h-4 w-4 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <History className="h-3.5 w-3.5" /> Letzte Ausführungen ({runs.length})
        </div>
        {runs.length === 0 ? (
          <div className="text-sm text-muted-foreground">Noch keine Ausführungen.</div>
        ) : (
          <div className="space-y-1.5">
            {runs.map((run) => (
              <div key={run.id} className="flex items-center justify-between rounded border border-border/60 px-3 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant={run.status === "ok" ? "default" : run.status === "error" ? "destructive" : "outline"}>
                    {run.status}
                  </Badge>
                  <span className="font-mono">{run.action}</span>
                </div>
                <span className="text-muted-foreground">{new Date(run.created_at).toLocaleString("de-DE")}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
