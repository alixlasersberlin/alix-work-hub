import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Play, FlaskConical, Trash2, ArrowRight, GitBranch, Timer, Zap, Split, Flag, Save, Users } from "lucide-react";

type NodeKind = "trigger" | "action" | "condition" | "wait" | "ab_split" | "end";
type FlowNode = { id: string; kind: NodeKind; label?: string; config?: any };
type FlowEdge = { from: string; to: string; branch?: string };
type Graph = { nodes: FlowNode[]; edges: FlowEdge[] };

const KIND_ICON: Record<NodeKind, any> = { trigger: Zap, action: Play, condition: GitBranch, wait: Timer, ab_split: Split, end: Flag };
const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_GRAPH: Graph = {
  nodes: [
    { id: "t1", kind: "trigger", label: "Enrollment" },
    { id: "a1", kind: "action", label: "Willkommens-Email", config: { action: "email", subject: "Willkommen {{name}}", body: "Hallo {{name}}, schön dich zu sehen!" } },
    { id: "w1", kind: "wait", label: "Warten 24h", config: { minutes: 1440 } },
    { id: "end", kind: "end", label: "Ende" },
  ],
  edges: [
    { from: "t1", to: "a1" },
    { from: "a1", to: "w1" },
    { from: "w1", to: "end" },
  ],
};

export default function JourneyOrchestrator() {
  const [journeys, setJourneys] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollContact, setEnrollContact] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("ac_journeys").select("*").order("created_at", { ascending: false });
    setJourneys(data ?? []);
    if (!selected && data?.length) setSelected(data[0]);
  };

  const loadRuns = async (jid: string) => {
    const { data } = await supabase.from("ac_journey_runs").select("*").eq("journey_id", jid).order("updated_at", { ascending: false }).limit(50);
    setRuns(data ?? []);
  };

  useEffect(() => { load(); supabase.from("ac_contacts").select("id,name,email").order("name").limit(200).then(r => setContacts(r.data ?? [])); }, []);
  useEffect(() => { if (selected?.id) loadRuns(selected.id); }, [selected?.id]);

  const graph: Graph = useMemo(() => selected?.graph ?? DEFAULT_GRAPH, [selected]);

  const setGraph = (g: Graph) => setSelected({ ...selected, graph: g });

  const createJourney = async () => {
    const name = prompt("Journey-Name?");
    if (!name) return;
    const { data, error } = await supabase.from("ac_journeys").insert({ name, status: "draft", trigger_event: "manual", graph: DEFAULT_GRAPH }).select("*").maybeSingle();
    if (error) return toast.error(error.message);
    toast.success("Journey erstellt");
    await load();
    setSelected(data);
  };

  const saveJourney = async () => {
    if (!selected?.id) return;
    setLoading(true);
    const { error } = await supabase.from("ac_journeys").update({
      name: selected.name, description: selected.description, status: selected.status,
      trigger_event: selected.trigger_event, graph: selected.graph, ab_config: selected.ab_config ?? {},
      version: (selected.version ?? 1) + 1,
    }).eq("id", selected.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(`Journey v${(selected.version ?? 1) + 1} gespeichert`);
    load();
  };

  const removeJourney = async () => {
    if (!selected?.id || !confirm("Journey löschen?")) return;
    const { error } = await supabase.from("ac_journeys").delete().eq("id", selected.id);
    if (error) return toast.error(error.message);
    setSelected(null); load();
  };

  const runEngine = async (dry = false) => {
    const { data, error } = await supabase.functions.invoke("ac-journey-run", { body: { dry_run: dry, journey_id: selected?.id } });
    if (error) return toast.error(error.message);
    toast.success(`Engine ${dry ? "Dry-Run" : "Lauf"}: ${JSON.stringify(data)}`);
    if (selected?.id) loadRuns(selected.id);
  };

  const enroll = async () => {
    if (!selected?.id || !enrollContact) return;
    const { error } = await supabase.from("ac_journey_runs").insert({
      journey_id: selected.id, contact_id: enrollContact, status: "active", next_action_at: new Date().toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Kontakt enrolliert"); setEnrollOpen(false); loadRuns(selected.id);
  };

  const addNode = (kind: NodeKind) => {
    const id = uid();
    const label = { trigger: "Trigger", action: "Aktion", condition: "Bedingung", wait: "Warten", ab_split: "A/B Split", end: "Ende" }[kind];
    const config = kind === "wait" ? { minutes: 60 }
      : kind === "condition" ? { field: "tags", op: "contains", value: "vip" }
      : kind === "ab_split" ? { variants: ["A", "B"] }
      : kind === "action" ? { action: "email", subject: "", body: "" }
      : {};
    setGraph({ ...graph, nodes: [...graph.nodes, { id, kind, label, config }] });
  };

  const removeNode = (id: string) => {
    setGraph({ nodes: graph.nodes.filter(n => n.id !== id), edges: graph.edges.filter(e => e.from !== id && e.to !== id) });
  };

  const updateNode = (id: string, patch: Partial<FlowNode>) => {
    setGraph({ ...graph, nodes: graph.nodes.map(n => n.id === id ? { ...n, ...patch, config: { ...(n.config ?? {}), ...(patch.config ?? {}) } } : n) });
  };

  const setEdge = (from: string, to: string, branch?: string) => {
    const others = graph.edges.filter(e => !(e.from === from && (e.branch ?? "") === (branch ?? "")));
    setGraph({ ...graph, edges: to ? [...others, { from, to, branch }] : others });
  };

  const edgeFor = (from: string, branch?: string) =>
    graph.edges.find(e => e.from === from && (e.branch ?? "") === (branch ?? ""))?.to ?? "";

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Journey Orchestrator 2.0</h2>
          <p className="text-sm text-muted-foreground">Visuelle Flows mit Bedingungen, Wait, A/B-Splits · Cron alle 5 Minuten</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => runEngine(true)}><FlaskConical className="h-4 w-4 mr-1" />Dry-Run</Button>
          <Button variant="outline" size="sm" onClick={() => runEngine(false)}><Play className="h-4 w-4 mr-1" />Engine ausführen</Button>
          <Button size="sm" onClick={createJourney}><Plus className="h-4 w-4 mr-1" />Neue Journey</Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-3">
          <CardHeader><CardTitle className="text-sm">Journeys</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {journeys.map(j => (
              <button key={j.id} onClick={() => setSelected(j)} className={`w-full text-left px-2 py-1.5 rounded text-sm ${selected?.id === j.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                <div className="flex items-center justify-between">
                  <span className="truncate">{j.name}</span>
                  <Badge variant={j.status === "active" ? "default" : "secondary"} className="text-[10px]">{j.status}</Badge>
                </div>
              </button>
            ))}
            {!journeys.length && <p className="text-xs text-muted-foreground">Keine Journeys angelegt.</p>}
          </CardContent>
        </Card>

        <div className="col-span-9 space-y-4">
          {!selected && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Journey auswählen oder erstellen.</CardContent></Card>}
          {selected && (
            <>
              <Card>
                <CardContent className="pt-6 grid md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Name</label>
                    <Input value={selected.name ?? ""} onChange={e => setSelected({ ...selected, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Trigger-Event</label>
                    <Input value={selected.trigger_event ?? ""} onChange={e => setSelected({ ...selected, trigger_event: e.target.value })} placeholder="manual, contact.created, ..." />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Status</label>
                    <Select value={selected.status ?? "draft"} onValueChange={v => setSelected({ ...selected, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Entwurf</SelectItem>
                        <SelectItem value="active">Aktiv</SelectItem>
                        <SelectItem value="paused">Pausiert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-4">
                    <label className="text-xs text-muted-foreground">Beschreibung</label>
                    <Textarea rows={2} value={selected.description ?? ""} onChange={e => setSelected({ ...selected, description: e.target.value })} />
                  </div>
                  <div className="md:col-span-4 flex justify-between">
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveJourney} disabled={loading}><Save className="h-4 w-4 mr-1" />Speichern (v{selected.version ?? 1})</Button>
                      <Button size="sm" variant="outline" onClick={() => setEnrollOpen(true)}><Users className="h-4 w-4 mr-1" />Kontakt enrollieren</Button>
                    </div>
                    <Button size="sm" variant="destructive" onClick={removeJourney}><Trash2 className="h-4 w-4 mr-1" />Löschen</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">Flow-Graph</CardTitle>
                  <div className="flex flex-wrap gap-1">
                    {(["trigger","action","condition","wait","ab_split","end"] as NodeKind[]).map(k => {
                      const Icon = KIND_ICON[k];
                      return <Button key={k} size="sm" variant="outline" onClick={() => addNode(k)}><Icon className="h-3.5 w-3.5 mr-1" />{k}</Button>;
                    })}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {graph.nodes.map(n => {
                    const Icon = KIND_ICON[n.kind];
                    return (
                      <div key={n.id} className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <Badge variant="outline" className="text-[10px]">{n.kind}</Badge>
                          <Input className="h-7 max-w-xs" value={n.label ?? ""} onChange={e => updateNode(n.id, { label: e.target.value })} />
                          <code className="text-[10px] text-muted-foreground">{n.id}</code>
                          <div className="ml-auto"><Button size="sm" variant="ghost" onClick={() => removeNode(n.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>
                        </div>

                        {n.kind === "action" && (
                          <div className="grid md:grid-cols-4 gap-2">
                            <Select value={n.config?.action ?? "email"} onValueChange={v => updateNode(n.id, { config: { action: v } })}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["email","sms","whatsapp","webhook","tag","notify_admin"].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {n.config?.action === "email" && <Input className="h-8 md:col-span-3" placeholder="Betreff" value={n.config?.subject ?? ""} onChange={e => updateNode(n.id, { config: { subject: e.target.value } })} />}
                            {n.config?.action === "webhook" && <Input className="h-8 md:col-span-3" placeholder="URL" value={n.config?.url ?? ""} onChange={e => updateNode(n.id, { config: { url: e.target.value } })} />}
                            {n.config?.action === "tag" && <Input className="h-8 md:col-span-3" placeholder="Tag" value={n.config?.tag ?? ""} onChange={e => updateNode(n.id, { config: { tag: e.target.value } })} />}
                            {["email","sms","whatsapp","notify_admin"].includes(n.config?.action ?? "email") && (
                              <Textarea className="md:col-span-4" rows={3} placeholder="Body (Platzhalter: {{name}}, {{email}})" value={n.config?.body ?? ""} onChange={e => updateNode(n.id, { config: { body: e.target.value } })} />
                            )}
                          </div>
                        )}
                        {n.kind === "wait" && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Minuten</span>
                            <Input type="number" className="h-8 w-32" value={n.config?.minutes ?? 60} onChange={e => updateNode(n.id, { config: { minutes: Number(e.target.value) } })} />
                          </div>
                        )}
                        {n.kind === "condition" && (
                          <div className="grid grid-cols-3 gap-2">
                            <Input className="h-8" placeholder="Feld (z.B. tags)" value={n.config?.field ?? ""} onChange={e => updateNode(n.id, { config: { field: e.target.value } })} />
                            <Select value={n.config?.op ?? "eq"} onValueChange={v => updateNode(n.id, { config: { op: v } })}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>{["eq","neq","gt","lt","contains","exists"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                            </Select>
                            <Input className="h-8" placeholder="Wert" value={n.config?.value ?? ""} onChange={e => updateNode(n.id, { config: { value: e.target.value } })} />
                          </div>
                        )}
                        {n.kind === "ab_split" && (
                          <Input className="h-8" placeholder="Varianten (kommagetrennt, z.B. A,B)" value={(n.config?.variants ?? []).join(",")} onChange={e => updateNode(n.id, { config: { variants: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } })} />
                        )}

                        {n.kind !== "end" && (
                          <div className="space-y-1">
                            {(n.kind === "condition" ? ["yes","no"] : n.kind === "ab_split" ? (n.config?.variants ?? ["A","B"]) : [""]).map((br: string) => (
                              <div key={br} className="flex items-center gap-2 text-xs">
                                <ArrowRight className="h-3 w-3" />
                                {br && <Badge variant="secondary" className="text-[10px]">{br}</Badge>}
                                <span className="text-muted-foreground">→</span>
                                <Select value={edgeFor(n.id, br || undefined) || "__none__"} onValueChange={v => setEdge(n.id, v === "__none__" ? "" : v, br || undefined)}>
                                  <SelectTrigger className="h-7 max-w-xs"><SelectValue placeholder="Ziel-Node" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">— kein Ziel —</SelectItem>
                                    {graph.nodes.filter(x => x.id !== n.id).map(x => (
                                      <SelectItem key={x.id} value={x.id}>{x.label ?? x.kind} ({x.id})</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Runs ({runs.length})</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-xs space-y-1 max-h-72 overflow-auto">
                    {runs.map(r => (
                      <div key={r.id} className="flex items-center justify-between border-b border-border/40 py-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={r.status === "completed" ? "default" : r.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">{r.status}</Badge>
                          <span className="font-mono text-[10px]">{r.contact_id?.slice(0, 8)}</span>
                          <span className="text-muted-foreground">Node: {r.current_node_id ?? "—"}</span>
                          {r.variant && <Badge variant="outline" className="text-[10px]">{r.variant}</Badge>}
                        </div>
                        <span className="text-muted-foreground">{r.next_action_at ? new Date(r.next_action_at).toLocaleString() : ""}</span>
                      </div>
                    ))}
                    {!runs.length && <p className="text-muted-foreground">Noch keine Runs.</p>}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kontakt enrollieren</DialogTitle></DialogHeader>
          <Select value={enrollContact} onValueChange={setEnrollContact}>
            <SelectTrigger><SelectValue placeholder="Kontakt wählen" /></SelectTrigger>
            <SelectContent>{contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name ?? c.email ?? c.id}</SelectItem>)}</SelectContent>
          </Select>
          <DialogFooter><Button onClick={enroll} disabled={!enrollContact}>Enrollieren</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
