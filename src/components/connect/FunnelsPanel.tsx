import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";

type Step = { kind: "pageview" | "event" | "scroll"; match: string; label?: string };
type Funnel = {
  id: string; website_id: string; name: string; description: string | null;
  steps: Step[]; window_hours: number; is_active: boolean;
};
type StatRow = { step_index: number; step_label: string; visitors: number; conversion_pct: number };

export default function FunnelsPanel({ websiteId, from, to }: { websiteId: string; from: Date; to: Date }) {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [stats, setStats] = useState<Record<string, StatRow[]>>({});
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ name: string; description: string; window_hours: number; steps: Step[] }>({
    name: "", description: "", window_hours: 24,
    steps: [{ kind: "pageview", match: "/", label: "Landing" }, { kind: "pageview", match: "/kontakt", label: "Kontakt" }],
  });

  async function load() {
    const { data } = await supabase.from("ac_web_funnels").select("*").eq("website_id", websiteId).order("created_at", { ascending: false });
    const rows = (data as any as Funnel[]) ?? [];
    setFunnels(rows);
    const map: Record<string, StatRow[]> = {};
    await Promise.all(rows.map(async (f) => {
      const { data: s } = await supabase.rpc("ac_web_funnel_stats", { _funnel_id: f.id, _from: from.toISOString(), _to: to.toISOString() });
      map[f.id] = (s as any) ?? [];
    }));
    setStats(map);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [websiteId, from.getTime(), to.getTime()]);

  async function save() {
    if (!draft.name.trim() || draft.steps.length < 2) { toast.error("Name + mindestens 2 Schritte"); return; }
    const { error } = await supabase.from("ac_web_funnels").insert({
      website_id: websiteId, name: draft.name, description: draft.description || null,
      window_hours: draft.window_hours, steps: draft.steps as any, is_active: true,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Trichter angelegt");
    setOpen(false);
    setDraft({ name: "", description: "", window_hours: 24, steps: [{ kind: "pageview", match: "/", label: "Landing" }, { kind: "pageview", match: "/kontakt", label: "Kontakt" }] });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Trichter löschen?")) return;
    const { error } = await supabase.from("ac_web_funnels").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" /> Funnels</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Neuer Trichter</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Trichter anlegen</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                <div><Label>Fenster (Stunden)</Label><Input type="number" value={draft.window_hours} onChange={(e) => setDraft({ ...draft, window_hours: Number(e.target.value) || 24 })} /></div>
              </div>
              <div><Label>Beschreibung</Label><Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Schritte</Label>
                  <Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, steps: [...draft.steps, { kind: "pageview", match: "", label: "" }] })}><Plus className="h-3 w-3 mr-1" /> Schritt</Button>
                </div>
                <div className="space-y-2">
                  {draft.steps.map((s, i) => (
                    <div key={i} className="grid grid-cols-[80px_140px_1fr_1fr_auto] gap-2 items-center">
                      <span className="text-xs text-muted-foreground">#{i + 1}</span>
                      <Select value={s.kind} onValueChange={(v) => {
                        const st = [...draft.steps]; st[i] = { ...st[i], kind: v as any }; setDraft({ ...draft, steps: st });
                      }}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pageview">Seitenaufruf</SelectItem>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="scroll">Scroll ≥ %</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input placeholder={s.kind === "pageview" ? "/pfad" : s.kind === "event" ? "event_name" : "50"} value={s.match} onChange={(e) => {
                        const st = [...draft.steps]; st[i] = { ...st[i], match: e.target.value }; setDraft({ ...draft, steps: st });
                      }} className="h-8" />
                      <Input placeholder="Label" value={s.label || ""} onChange={(e) => {
                        const st = [...draft.steps]; st[i] = { ...st[i], label: e.target.value }; setDraft({ ...draft, steps: st });
                      }} className="h-8" />
                      <Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={save}>Speichern</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {funnels.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Trichter angelegt.</p>}
        {funnels.map((f) => {
          const rows = stats[f.id] ?? [];
          const max = Math.max(1, ...rows.map((r) => r.visitors));
          return (
            <div key={f.id} className="rounded-md border border-border/60 p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-medium">{f.name}</div>
                  {f.description && <div className="text-xs text-muted-foreground">{f.description}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">Fenster {f.window_hours}h</Badge>
                  <Button size="icon" variant="ghost" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="space-y-1">
                {rows.map((r) => (
                  <div key={r.step_index} className="grid grid-cols-[1fr_60px_60px] items-center gap-3">
                    <div className="relative h-7 rounded bg-muted overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-primary/70" style={{ width: `${(r.visitors / max) * 100}%` }} />
                      <div className="relative px-2 py-1 text-xs font-medium flex items-center gap-2">
                        <Play className="h-3 w-3" /> {r.step_label}
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold">{r.visitors}</div>
                    <div className="text-right text-xs text-muted-foreground">{Number(r.conversion_pct).toFixed(1)}%</div>
                  </div>
                ))}
                {rows.length === 0 && <div className="text-xs text-muted-foreground">Keine Daten im Zeitraum.</div>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
