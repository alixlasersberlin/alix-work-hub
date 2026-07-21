import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Workflow, Plus, Play, Pause, Trash2, ChevronRight, Clock, Mail, MessageSquare } from "lucide-react";

type Journey = { id: string; name: string; description: string | null; trigger_event: string; status: string; created_at: string };
type Step = { id: string; journey_id: string; position: number; kind: string; config: any };

const TRIGGER_EVENTS = [
  "order.created", "order.completed", "ticket.opened", "ticket.closed",
  "customer.signup", "customer.inactive_30d", "invoice.overdue", "manual",
];
const STEP_KINDS = [
  { v: "send_email", label: "Email senden", icon: Mail },
  { v: "send_sms", label: "SMS senden", icon: MessageSquare },
  { v: "send_whatsapp", label: "WhatsApp senden", icon: MessageSquare },
  { v: "wait", label: "Warten", icon: Clock },
];

export default function Journeys() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selected, setSelected] = useState<Journey | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("order.created");

  const [stepKind, setStepKind] = useState("send_email");
  const [stepSubject, setStepSubject] = useState("");
  const [stepBody, setStepBody] = useState("");
  const [waitMinutes, setWaitMinutes] = useState("60");

  async function loadJourneys() {
    setLoading(true);
    const { data } = await supabase.from("ac_journeys" as any)
      .select("id,name,description,trigger_event,status,created_at")
      .order("created_at", { ascending: false });
    setJourneys((data as any) ?? []);
    setLoading(false);
  }
  async function loadSteps(id: string) {
    const { data } = await supabase.from("ac_journey_steps" as any)
      .select("id,journey_id,position,kind,config").eq("journey_id", id).order("position");
    setSteps((data as any) ?? []);
  }
  useEffect(() => { loadJourneys(); }, []);
  useEffect(() => { if (selected) loadSteps(selected.id); else setSteps([]); }, [selected]);

  async function createJourney() {
    if (!name) return toast.error("Name erforderlich");
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("ac_journeys" as any)
      .insert({ name, description: description || null, trigger_event: triggerEvent, created_by: user.user?.id })
      .select("*").single();
    if (error) return toast.error(error.message);
    toast.success("Journey erstellt");
    setName(""); setDescription("");
    loadJourneys();
    setSelected(data as any);
  }
  async function toggleStatus(j: Journey) {
    const next = j.status === "active" ? "paused" : "active";
    const { error } = await supabase.from("ac_journeys" as any).update({ status: next }).eq("id", j.id);
    if (error) return toast.error(error.message);
    toast.success(next === "active" ? "Aktiviert" : "Pausiert");
    loadJourneys();
    if (selected?.id === j.id) setSelected({ ...j, status: next });
  }
  async function removeJourney(id: string) {
    if (!confirm("Journey löschen?")) return;
    const { error } = await supabase.from("ac_journeys" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selected?.id === id) setSelected(null);
    loadJourneys();
  }
  async function addStep() {
    if (!selected) return;
    const config = stepKind === "wait"
      ? { minutes: Number(waitMinutes) || 60 }
      : stepKind === "send_email"
        ? { subject: stepSubject, body: stepBody }
        : { body: stepBody };
    const { error } = await supabase.from("ac_journey_steps" as any).insert({
      journey_id: selected.id, position: steps.length, kind: stepKind, config,
    });
    if (error) return toast.error(error.message);
    setStepSubject(""); setStepBody("");
    loadSteps(selected.id);
  }
  async function removeStep(id: string) {
    const { error } = await supabase.from("ac_journey_steps" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadSteps(selected!.id);
  }

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Journeys</h2>
        </div>

        <Card>
          <CardHeader><CardTitle>Neue Journey</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Beschreibung" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Select value={triggerEvent} onValueChange={setTriggerEvent}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TRIGGER_EVENTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
            <Button className="w-full" onClick={createJourney}><Plus className="h-4 w-4 mr-2" />Erstellen</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Alle ({journeys.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {loading ? <p className="text-sm text-muted-foreground">Lade…</p> : journeys.map((j) => (
              <div key={j.id}
                className={`rounded-md border p-2 cursor-pointer ${selected?.id === j.id ? "border-primary bg-primary/5" : "border-border/50"}`}
                onClick={() => setSelected(j)}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{j.name}</span>
                  <Badge variant={j.status === "active" ? "default" : "secondary"} className="text-[10px]">{j.status}</Badge>
                </div>
                <div className="text-[11px] text-muted-foreground">Trigger: {j.trigger_event}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div>
        {!selected ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Journey auswählen oder erstellen.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selected.name}</h3>
                <p className="text-xs text-muted-foreground">Trigger: {selected.trigger_event}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toggleStatus(selected)}>
                  {selected.status === "active" ? <><Pause className="h-4 w-4 mr-2" />Pausieren</> : <><Play className="h-4 w-4 mr-2" />Aktivieren</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removeJourney(selected.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>

            <Card>
              <CardHeader><CardTitle>Schritte ({steps.length})</CardTitle></CardHeader>
              <CardContent>
                {steps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Noch keine Schritte.</p>
                ) : (
                  <div className="space-y-2">
                    {steps.map((s, i) => (
                      <div key={s.id} className="flex items-start gap-3 rounded-md border border-border/50 p-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold">{i + 1}</div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{STEP_KINDS.find((k) => k.v === s.kind)?.label ?? s.kind}</div>
                          <div className="text-xs text-muted-foreground font-mono">{JSON.stringify(s.config)}</div>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => removeStep(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Schritt hinzufügen</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Select value={stepKind} onValueChange={setStepKind}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STEP_KINDS.map((k) => <SelectItem key={k.v} value={k.v}>{k.label}</SelectItem>)}</SelectContent>
                </Select>
                {stepKind === "wait" ? (
                  <div><Label>Minuten warten</Label><Input type="number" value={waitMinutes} onChange={(e) => setWaitMinutes(e.target.value)} /></div>
                ) : (
                  <>
                    {stepKind === "send_email" && <Input placeholder="Betreff" value={stepSubject} onChange={(e) => setStepSubject(e.target.value)} />}
                    <Textarea rows={4} placeholder="Inhalt (Platzhalter: {{name}})" value={stepBody} onChange={(e) => setStepBody(e.target.value)} />
                  </>
                )}
                <Button onClick={addStep}><Plus className="h-4 w-4 mr-2" />Schritt hinzufügen</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
