import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Rule = {
  id: string;
  name: string;
  trigger: "message.received" | "conversation.created" | "sla.breached" | "keyword.matched";
  channel: "any" | "website_chat" | "whatsapp" | "sms" | "email" | "messenger" | "instagram";
  keyword?: string;
  action: "assign" | "tag" | "auto_reply" | "escalate" | "webhook";
  actionValue: string;
  active: boolean;
};

const KEY = "ac_automation_rules";

export default function AlixConnectAutomation() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [draft, setDraft] = useState<Rule>({
    id: "",
    name: "",
    trigger: "message.received",
    channel: "any",
    action: "auto_reply",
    actionValue: "",
    active: true,
  });

  useEffect(() => {
    try { setRules(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { setRules([]); }
  }, []);

  const save = (next: Rule[]) => {
    setRules(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const add = () => {
    if (!draft.name.trim() || !draft.actionValue.trim()) {
      toast.error("Name und Aktion erforderlich");
      return;
    }
    save([...rules, { ...draft, id: crypto.randomUUID() }]);
    setDraft({ ...draft, name: "", actionValue: "", keyword: "" });
    toast.success("Regel gespeichert");
  };

  const remove = (id: string) => save(rules.filter((r) => r.id !== id));
  const toggle = (id: string) => save(rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Automation &amp; Workflows
          <Badge variant="outline" className="ml-2">Phase 7</Badge>
        </h2>
        <p className="text-sm text-muted-foreground">Wenn/Dann-Regeln für alle Kanäle — Auto-Reply, Tagging, Eskalation, Webhooks.</p>
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
          <Input placeholder="Keyword (z.B. Preis, Rechnung, Reklamation)" value={draft.keyword || ""} onChange={(e) => setDraft({ ...draft, keyword: e.target.value })} />
        )}
        <div className="grid md:grid-cols-[220px_1fr] gap-2">
          <Select value={draft.action} onValueChange={(v: any) => setDraft({ ...draft, action: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto_reply">Auto-Antwort senden</SelectItem>
              <SelectItem value="assign">Zuweisen an User</SelectItem>
              <SelectItem value="tag">Tag hinzufügen</SelectItem>
              <SelectItem value="escalate">Eskalieren an Team</SelectItem>
              <SelectItem value="webhook">Webhook URL aufrufen</SelectItem>
            </SelectContent>
          </Select>
          <Textarea rows={2} placeholder={
            draft.action === "auto_reply" ? "Antworttext…"
              : draft.action === "webhook" ? "https://…"
              : draft.action === "assign" ? "User-E-Mail"
              : "Wert…"
          } value={draft.actionValue} onChange={(e) => setDraft({ ...draft, actionValue: e.target.value })} />
        </div>
        <div className="flex justify-end">
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> Regel hinzufügen</Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Aktive Regeln ({rules.length})</div>
        {rules.length === 0 ? (
          <div className="text-sm text-muted-foreground">Noch keine Regeln definiert.</div>
        ) : (
          <div className="space-y-2">
            {rules.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded border border-border/60 p-3">
                <Switch checked={r.active} onCheckedChange={() => toggle(r.id)} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {r.trigger} · {r.channel}{r.keyword ? ` · "${r.keyword}"` : ""} → {r.action}: {r.actionValue}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 text-xs text-muted-foreground">
        Regeln werden lokal gespeichert und dienen als Blueprint. Der Engine-Rollout (Server-Side Trigger via Postgres-Trigger + Edge Function) erfolgt schrittweise anhand der aktivsten Regeln.
      </Card>
    </div>
  );
}
