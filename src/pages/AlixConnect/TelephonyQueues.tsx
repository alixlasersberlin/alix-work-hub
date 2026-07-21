import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Users, Plus, Trash2, PhoneCall, Circle, Pause, PhoneOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type Queue = {
  id: string;
  name: string;
  extension: string | null;
  strategy: string;
  required_skills: string[];
  enabled: boolean;
};
type QueueAgent = { id: string; queue_id: string; user_id: string; priority: number };
type Presence = {
  user_id: string;
  status: string;
  custom_status: string | null;
  last_seen_at: string | null;
  skills: string[];
  active_queue_id: string | null;
};
type Profile = { id: string; full_name: string | null; email: string | null };

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  available: { label: "Verfügbar", color: "bg-emerald-500", icon: Circle },
  busy: { label: "Im Gespräch", color: "bg-red-500", icon: PhoneCall },
  away: { label: "Pause", color: "bg-amber-500", icon: Pause },
  offline: { label: "Offline", color: "bg-zinc-500", icon: PhoneOff },
};

export default function TelephonyQueues() {
  const { user, roles } = useAuth();
  const isAdmin = roles?.some((r) => r === "Admin" || r === "Super Admin");

  const [queues, setQueues] = useState<Queue[]>([]);
  const [agents, setAgents] = useState<QueueAgent[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQueue, setNewQueue] = useState({ name: "", extension: "", strategy: "ringall", skills: "" });

  const myPresence = useMemo(() => presence.find((p) => p.user_id === user?.id), [presence, user?.id]);

  async function load() {
    setLoading(true);
    const [q, a, p, u] = await Promise.all([
      supabase.from("ac_pbx_queues").select("*").order("name"),
      supabase.from("ac_pbx_queue_agents").select("*"),
      supabase.from("ac_user_presence").select("*"),
      supabase.from("user_profiles").select("id, full_name, email"),
    ]);
    setQueues((q.data as any) || []);
    setAgents((a.data as any) || []);
    setPresence((p.data as any) || []);
    setProfiles((u.data as any) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("pbx_queues")
      .on("postgres_changes", { event: "*", schema: "public", table: "ac_user_presence" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ac_pbx_queue_agents" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ac_pbx_queues" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function upsertMyPresence(patch: Partial<Presence>) {
    if (!user?.id) return;
    const base = myPresence ?? {
      user_id: user.id,
      status: "offline",
      custom_status: null,
      last_seen_at: new Date().toISOString(),
      skills: [],
      active_queue_id: null,
    };
    const row = { ...base, ...patch, last_seen_at: new Date().toISOString() };
    const { error } = await supabase.from("ac_user_presence").upsert(row, { onConflict: "user_id" });
    if (error) toast.error(error.message);
  }

  async function createQueue() {
    if (!newQueue.name.trim()) return;
    const { error } = await supabase.from("ac_pbx_queues").insert({
      name: newQueue.name.trim(),
      extension: newQueue.extension.trim() || null,
      strategy: newQueue.strategy,
      required_skills: newQueue.skills.split(",").map((s) => s.trim()).filter(Boolean),
    });
    if (error) return toast.error(error.message);
    setNewQueue({ name: "", extension: "", strategy: "ringall", skills: "" });
    toast.success("Warteschlange angelegt");
  }

  async function toggleQueue(q: Queue) {
    await supabase.from("ac_pbx_queues").update({ enabled: !q.enabled }).eq("id", q.id);
  }
  async function deleteQueue(id: string) {
    if (!confirm("Warteschlange löschen?")) return;
    await supabase.from("ac_pbx_queues").delete().eq("id", id);
  }
  async function assignAgent(queueId: string, userId: string) {
    const { error } = await supabase.from("ac_pbx_queue_agents").insert({ queue_id: queueId, user_id: userId });
    if (error) toast.error(error.message);
  }
  async function removeAgent(id: string) {
    await supabase.from("ac_pbx_queue_agents").delete().eq("id", id);
  }

  const profileName = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p?.full_name || p?.email || id.slice(0, 8);
  };
  const statusOf = (id: string) => presence.find((p) => p.user_id === id)?.status ?? "offline";

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* My presence */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Mein Agenten-Status
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={myPresence?.status ?? "offline"} onValueChange={(v) => upsertMyPresence({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Aktive Warteschlange</Label>
            <Select
              value={myPresence?.active_queue_id ?? "none"}
              onValueChange={(v) => upsertMyPresence({ active_queue_id: v === "none" ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="Keine" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— keine —</SelectItem>
                {queues.filter((q) => q.enabled).map((q) => (
                  <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Skills (kommagetrennt)</Label>
            <Input
              defaultValue={myPresence?.skills?.join(", ") ?? ""}
              onBlur={(e) => upsertMyPresence({ skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              placeholder="z.B. de, en, laser, service"
            />
          </div>
        </CardContent>
      </Card>

      {/* Agents board */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Agenten-Board</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {presence.length === 0 && <div className="text-sm text-muted-foreground">Keine Präsenz-Daten.</div>}
            {presence.map((p) => {
              const meta = STATUS_META[p.status] ?? STATUS_META.offline;
              const q = queues.find((x) => x.id === p.active_queue_id);
              return (
                <div key={p.user_id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.color}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{profileName(p.user_id)}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {meta.label}{q ? ` · ${q.name}` : ""}{p.skills?.length ? ` · ${p.skills.join(", ")}` : ""}
                      </div>
                    </div>
                  </div>
                  {p.custom_status && <Badge variant="outline" className="text-[10px]">{p.custom_status}</Badge>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Queues */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base">Warteschlangen</CardTitle>
          {isAdmin && (
            <div className="flex flex-wrap gap-2 items-end">
              <Input className="w-40" placeholder="Name" value={newQueue.name} onChange={(e) => setNewQueue({ ...newQueue, name: e.target.value })} />
              <Input className="w-28" placeholder="Ext." value={newQueue.extension} onChange={(e) => setNewQueue({ ...newQueue, extension: e.target.value })} />
              <Select value={newQueue.strategy} onValueChange={(v) => setNewQueue({ ...newQueue, strategy: v })}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ringall">Alle klingeln</SelectItem>
                  <SelectItem value="roundrobin">Round Robin</SelectItem>
                  <SelectItem value="leastrecent">Least Recent</SelectItem>
                  <SelectItem value="skills">Skills-based</SelectItem>
                  <SelectItem value="priority">Priorität</SelectItem>
                </SelectContent>
              </Select>
              <Input className="w-48" placeholder="Skills (kommagetrennt)" value={newQueue.skills} onChange={(e) => setNewQueue({ ...newQueue, skills: e.target.value })} />
              <Button size="sm" onClick={createQueue}><Plus className="h-4 w-4 mr-1" />Anlegen</Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <div className="text-sm text-muted-foreground">Lade …</div>}
          {!loading && queues.length === 0 && <div className="text-sm text-muted-foreground">Noch keine Warteschlangen.</div>}
          {queues.map((q) => {
            const qAgents = agents.filter((a) => a.queue_id === q.id);
            const unassigned = profiles.filter((p) => !qAgents.find((a) => a.user_id === p.id));
            return (
              <div key={q.id} className="rounded-lg border border-border/60 bg-card/30 p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full ${q.enabled ? "bg-emerald-500" : "bg-zinc-500"}`} />
                    <div className="font-medium">{q.name}</div>
                    {q.extension && <Badge variant="outline" className="text-[10px]">Ext {q.extension}</Badge>}
                    <Badge variant="secondary" className="text-[10px]">{q.strategy}</Badge>
                    {q.required_skills.map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                    ))}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <Switch checked={q.enabled} onCheckedChange={() => toggleQueue(q)} />
                      <Button size="icon" variant="ghost" onClick={() => deleteQueue(q.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {qAgents.map((a) => {
                    const st = statusOf(a.user_id);
                    const meta = STATUS_META[st] ?? STATUS_META.offline;
                    return (
                      <div key={a.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 pl-2 pr-1 py-1 text-xs">
                        <span className={`h-2 w-2 rounded-full ${meta.color}`} />
                        <span>{profileName(a.user_id)}</span>
                        <span className="text-muted-foreground">P{a.priority}</span>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => removeAgent(a.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  {isAdmin && unassigned.length > 0 && (
                    <Select onValueChange={(v) => assignAgent(q.id, v)}>
                      <SelectTrigger className="h-7 w-48 text-xs"><SelectValue placeholder="+ Agent zuweisen" /></SelectTrigger>
                      <SelectContent>
                        {unassigned.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
