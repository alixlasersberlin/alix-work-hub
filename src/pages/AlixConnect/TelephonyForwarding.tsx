import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, PhoneForwarded, Save } from "lucide-react";
import { toast } from "sonner";

type Rule = {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  condition: "always" | "busy" | "no_answer" | "offline" | "schedule";
  schedule: Record<string, any>;
  destination_type: "extension" | "mobile" | "voicemail" | "queue" | "external";
  destination: string;
  ring_timeout_seconds: number;
  priority: number;
  notes: string | null;
};

const CONDITIONS: { value: Rule["condition"]; label: string }[] = [
  { value: "always", label: "Immer" },
  { value: "busy", label: "Wenn besetzt" },
  { value: "no_answer", label: "Keine Antwort" },
  { value: "offline", label: "Wenn offline" },
  { value: "schedule", label: "Zeitplan" },
];

const DEST_TYPES: { value: Rule["destination_type"]; label: string }[] = [
  { value: "extension", label: "Nebenstelle" },
  { value: "mobile", label: "Mobilnummer" },
  { value: "voicemail", label: "Voicemail" },
  { value: "queue", label: "Warteschlange" },
  { value: "external", label: "Externe Nummer" },
];

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function TelephonyForwarding() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUserId(u.user.id);
    const { data, error } = await supabase
      .from("ac_pbx_forwarding_rules")
      .select("*")
      .order("priority", { ascending: true });
    if (error) toast.error(error.message);
    else setRules((data as any) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addRule() {
    if (!userId) return;
    const { data, error } = await supabase
      .from("ac_pbx_forwarding_rules")
      .insert({
        user_id: userId,
        name: "Neue Regel",
        condition: "always",
        destination_type: "mobile",
        destination: "",
      })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setRules((r) => [...r, data as any]);
  }

  async function saveRule(rule: Rule) {
    const { error } = await supabase
      .from("ac_pbx_forwarding_rules")
      .update({
        name: rule.name,
        enabled: rule.enabled,
        condition: rule.condition,
        schedule: rule.schedule,
        destination_type: rule.destination_type,
        destination: rule.destination,
        ring_timeout_seconds: rule.ring_timeout_seconds,
        priority: rule.priority,
        notes: rule.notes,
      })
      .eq("id", rule.id);
    if (error) return toast.error(error.message);
    toast.success("Gespeichert");
  }

  async function deleteRule(id: string) {
    if (!confirm("Regel löschen?")) return;
    const { error } = await supabase.from("ac_pbx_forwarding_rules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRules((r) => r.filter((x) => x.id !== id));
  }

  function update(id: string, patch: Partial<Rule>) {
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <PhoneForwarded className="h-5 w-5" /> Rufumleitung & Follow-Me
          </h2>
          <p className="text-xs text-muted-foreground">
            Regeln pro Bedingung – niedrigste Priorität zuerst.
          </p>
        </div>
        <Button onClick={addRule} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Neue Regel
        </Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Lade…</div>}
      {!loading && rules.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Noch keine Umleitungsregeln. Lege eine an, um Anrufe automatisch weiterzuleiten.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {rules.map((r) => (
          <Card key={r.id} className={r.enabled ? "" : "opacity-60"}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <Switch
                    checked={r.enabled}
                    onCheckedChange={(v) => update(r.id, { enabled: v })}
                  />
                  <Input
                    value={r.name}
                    onChange={(e) => update(r.id, { name: e.target.value })}
                    className="max-w-xs h-8"
                  />
                  <Badge variant="outline">Prio {r.priority}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => saveRule(r)}>
                    <Save className="h-4 w-4 mr-1" /> Speichern
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteRule(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Bedingung</Label>
                <Select
                  value={r.condition}
                  onValueChange={(v: any) => update(r.id, { condition: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Ziel-Typ</Label>
                <Select
                  value={r.destination_type}
                  onValueChange={(v: any) => update(r.id, { destination_type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEST_TYPES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Ziel (Nummer / Extension / Queue-ID)</Label>
                <Input
                  value={r.destination}
                  onChange={(e) => update(r.id, { destination: e.target.value })}
                  placeholder={r.destination_type === "mobile" ? "+49170…" : "z. B. 201"}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Klingel-Timeout (s)</Label>
                  <Input
                    type="number"
                    value={r.ring_timeout_seconds}
                    onChange={(e) =>
                      update(r.id, { ring_timeout_seconds: parseInt(e.target.value || "20") })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Priorität</Label>
                  <Input
                    type="number"
                    value={r.priority}
                    onChange={(e) =>
                      update(r.id, { priority: parseInt(e.target.value || "100") })
                    }
                  />
                </div>
              </div>

              {r.condition === "schedule" && (
                <div className="md:col-span-2 space-y-2 rounded-md border border-border/60 p-3">
                  <Label className="text-xs">Zeitplan (Wochentage & Uhrzeit)</Label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((d, i) => {
                      const active = (r.schedule?.days || []).includes(i);
                      return (
                        <Button
                          key={d}
                          size="sm"
                          variant={active ? "default" : "outline"}
                          onClick={() => {
                            const days: number[] = r.schedule?.days || [];
                            const next = active ? days.filter((x) => x !== i) : [...days, i];
                            update(r.id, { schedule: { ...r.schedule, days: next } });
                          }}
                        >
                          {d}
                        </Button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Von</Label>
                      <Input
                        type="time"
                        value={r.schedule?.from || "09:00"}
                        onChange={(e) =>
                          update(r.id, { schedule: { ...r.schedule, from: e.target.value } })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Bis</Label>
                      <Input
                        type="time"
                        value={r.schedule?.to || "17:00"}
                        onChange={(e) =>
                          update(r.id, { schedule: { ...r.schedule, to: e.target.value } })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="md:col-span-2 space-y-1.5">
                <Label>Notizen</Label>
                <Textarea
                  rows={2}
                  value={r.notes || ""}
                  onChange={(e) => update(r.id, { notes: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
