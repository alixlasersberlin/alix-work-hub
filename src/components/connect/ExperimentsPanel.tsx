import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FlaskConical } from "lucide-react";
import { toast } from "sonner";

type Variant = { key: string; weight: number };
type Experiment = { id: string; website_id: string; name: string; description: string | null; variants: Variant[]; goal_event: string | null; is_active: boolean };
type Stat = { variant: string; exposures: number; conversions: number; conversion_pct: number };

export default function ExperimentsPanel({ websiteId, from, to }: { websiteId: string; from: Date; to: Date }) {
  const [items, setItems] = useState<Experiment[]>([]);
  const [stats, setStats] = useState<Record<string, Stat[]>>({});
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", description: "", goal_event: "", variants: [{ key: "A", weight: 50 }, { key: "B", weight: 50 }] as Variant[] });

  async function load() {
    const { data } = await supabase.from("ac_web_experiments").select("*").eq("website_id", websiteId).order("created_at", { ascending: false });
    const rows = (data as any as Experiment[]) ?? [];
    setItems(rows);
    const map: Record<string, Stat[]> = {};
    await Promise.all(rows.map(async (e) => {
      const { data: s } = await supabase.rpc("ac_web_experiment_stats", { _experiment_id: e.id, _from: from.toISOString(), _to: to.toISOString() });
      map[e.id] = (s as any) ?? [];
    }));
    setStats(map);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [websiteId, from.getTime(), to.getTime()]);

  async function save() {
    if (!draft.name.trim()) { toast.error("Name fehlt"); return; }
    const total = draft.variants.reduce((s, v) => s + Number(v.weight || 0), 0);
    if (total <= 0) { toast.error("Gewichte-Summe muss > 0 sein"); return; }
    const { error } = await supabase.from("ac_web_experiments").insert({
      website_id: websiteId, name: draft.name, description: draft.description || null,
      goal_event: draft.goal_event || null, variants: draft.variants as any, is_active: true,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Experiment angelegt");
    setOpen(false);
    setDraft({ name: "", description: "", goal_event: "", variants: [{ key: "A", weight: 50 }, { key: "B", weight: 50 }] });
    load();
  }

  async function toggle(e: Experiment) {
    await supabase.from("ac_web_experiments").update({ is_active: !e.is_active } as any).eq("id", e.id);
    load();
  }
  async function remove(id: string) {
    if (!confirm("Experiment löschen?")) return;
    await supabase.from("ac_web_experiments").delete().eq("id", id);
    load();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><FlaskConical className="h-4 w-4" /> A/B-Experimente</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Neu</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Experiment anlegen</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name (Kürzel)</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="hero_cta" /></div>
              <div><Label>Beschreibung</Label><Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
              <div><Label>Ziel-Event (optional, für Conversion-Rate)</Label><Input value={draft.goal_event} onChange={(e) => setDraft({ ...draft, goal_event: e.target.value })} placeholder="signup" /></div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Varianten & Gewichte</Label>
                  <Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, variants: [...draft.variants, { key: String.fromCharCode(65 + draft.variants.length), weight: 25 }] })}><Plus className="h-3 w-3 mr-1" /> Variante</Button>
                </div>
                {draft.variants.map((v, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2 mb-1">
                    <Input value={v.key} onChange={(e) => { const nv = [...draft.variants]; nv[i] = { ...v, key: e.target.value }; setDraft({ ...draft, variants: nv }); }} />
                    <Input type="number" value={v.weight} onChange={(e) => { const nv = [...draft.variants]; nv[i] = { ...v, weight: Number(e.target.value) || 0 }; setDraft({ ...draft, variants: nv }); }} />
                    <Button size="icon" variant="ghost" onClick={() => setDraft({ ...draft, variants: draft.variants.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter><Button onClick={save}>Speichern</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Experimente. Nutze im Website-Code <code className="text-xs">AlixConnect.experiment('name', [{`{key:'A',weight:50},{key:'B',weight:50}`}])</code>.</p>}
        {items.map((e) => (
          <div key={e.id} className="rounded-md border border-border/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  {e.name}
                  <Badge variant={e.is_active ? "default" : "outline"} className="text-[10px]">{e.is_active ? "aktiv" : "pausiert"}</Badge>
                  {e.goal_event && <Badge variant="secondary" className="text-[10px]">Ziel: {e.goal_event}</Badge>}
                </div>
                {e.description && <div className="text-xs text-muted-foreground">{e.description}</div>}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => toggle(e)}>{e.is_active ? "Pausieren" : "Starten"}</Button>
                <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="font-medium">Variante</div><div className="text-right">Exposures</div><div className="text-right">Conversions</div><div className="text-right">Rate</div>
              {(stats[e.id] ?? []).map((s) => (
                <>
                  <div key={s.variant + "k"}><Badge variant="outline">{s.variant}</Badge></div>
                  <div key={s.variant + "e"} className="text-right">{s.exposures}</div>
                  <div key={s.variant + "c"} className="text-right">{s.conversions}</div>
                  <div key={s.variant + "r"} className="text-right font-semibold">{Number(s.conversion_pct).toFixed(1)}%</div>
                </>
              ))}
              {(!stats[e.id] || stats[e.id].length === 0) && <div className="col-span-4 text-muted-foreground text-xs py-1">Noch keine Expositions-Events.</div>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
