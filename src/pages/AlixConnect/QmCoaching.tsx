import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GraduationCap, Plus, PenLine, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Coaching = {
  id: string; agent_id: string; coach_id: string | null;
  scheduled_at: string | null; duration_min: number; topics: string[] | null;
  strengths: string | null; improvements: string | null;
  actions: any; followup_at: string | null; status: string; agent_signed_at: string | null;
};

export default function QmCoaching() {
  const [rows, setRows] = useState<Coaching[]>([]);
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [when, setWhen] = useState("");
  const [topics, setTopics] = useState("");
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [actionsText, setActionsText] = useState("");
  const [me, setMe] = useState<string | null>(null);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    setMe(u.user?.id ?? null);
    const { data } = await supabase.from("ac_qm_coaching_sessions")
      .select("*").order("scheduled_at", { ascending: false, nullsFirst: false }).limit(50);
    setRows((data ?? []) as Coaching[]);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!agentId.trim()) return toast.error("Agent-ID (UUID) angeben");
    const actions = actionsText.split("\n").map((s) => s.trim()).filter(Boolean).map((t) => ({ text: t, done: false }));
    const { error } = await supabase.from("ac_qm_coaching_sessions").insert({
      agent_id: agentId.trim(),
      scheduled_at: when || null,
      topics: topics ? topics.split(",").map((s) => s.trim()) : null,
      strengths, improvements,
      actions, status: "scheduled",
    });
    if (error) return toast.error(error.message);
    toast.success("Coaching angelegt");
    setOpen(false); setAgentId(""); setWhen(""); setTopics(""); setStrengths(""); setImprovements(""); setActionsText("");
    load();
  }

  async function sign(id: string) {
    const { error } = await supabase.from("ac_qm_coaching_sessions")
      .update({ agent_signed_at: new Date().toISOString(), status: "signed" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Signiert"); load();
  }

  async function toggleAction(row: Coaching, idx: number) {
    const acts = Array.isArray(row.actions) ? [...row.actions] : [];
    if (!acts[idx]) return;
    acts[idx] = { ...acts[idx], done: !acts[idx].done };
    await supabase.from("ac_qm_coaching_sessions").update({ actions: acts }).eq("id", row.id);
    load();
  }

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">QM Coaching</h2>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Neues Coaching</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Coaching-Session planen</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Agent User-ID</Label><Input value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="UUID" /></div>
              <div><Label>Termin</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
              <div><Label>Themen (kommagetrennt)</Label><Input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="Empathie, Abschluss" /></div>
              <div><Label>Stärken</Label><Textarea rows={2} value={strengths} onChange={(e) => setStrengths(e.target.value)} /></div>
              <div><Label>Verbesserungen</Label><Textarea rows={2} value={improvements} onChange={(e) => setImprovements(e.target.value)} /></div>
              <div><Label>Aktionen (eine pro Zeile)</Label><Textarea rows={3} value={actionsText} onChange={(e) => setActionsText(e.target.value)} placeholder="Aktives Zuhören üben&#10;Skript Reklamationen wiederholen" /></div>
              <Button onClick={create}>Erstellen</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {rows.length === 0 && <p className="text-sm text-muted-foreground">Keine Coaching-Sessions.</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {rows.map((r) => {
          const isAgent = me === r.agent_id;
          const acts = Array.isArray(r.actions) ? r.actions : [];
          const done = acts.filter((a: any) => a.done).length;
          return (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{r.scheduled_at ? new Date(r.scheduled_at).toLocaleString() : "unbestimmt"} · {r.duration_min}min</CardTitle>
                  <Badge variant={r.status === "signed" ? "default" : "outline"}>{r.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">Agent: <span className="font-mono">{r.agent_id.slice(0,8)}</span> · Aktionen {done}/{acts.length}</div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {r.topics && r.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1">{r.topics.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}</div>
                )}
                {r.strengths && <div><div className="text-[10px] uppercase text-muted-foreground">Stärken</div><div>{r.strengths}</div></div>}
                {r.improvements && <div><div className="text-[10px] uppercase text-muted-foreground">Verbesserungen</div><div>{r.improvements}</div></div>}
                {acts.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase text-muted-foreground">Aktionen</div>
                    {acts.map((a: any, i: number) => (
                      <label key={i} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={!!a.done} onChange={() => toggleAction(r, i)} />
                        <span className={a.done ? "line-through text-muted-foreground" : ""}>{a.text}</span>
                      </label>
                    ))}
                  </div>
                )}
                {isAgent && !r.agent_signed_at && (
                  <Button size="sm" onClick={() => sign(r.id)} className="mt-2"><PenLine className="h-3 w-3 mr-1" />Signieren</Button>
                )}
                {r.agent_signed_at && (
                  <div className="flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="h-3 w-3" />signiert {new Date(r.agent_signed_at).toLocaleString()}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
