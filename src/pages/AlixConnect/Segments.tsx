import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Layers, Plus, RefreshCw, Trash2, Users } from "lucide-react";

type Segment = {
  id: string; name: string; description: string | null;
  filter: any; contact_count: number; last_computed_at: string | null;
};

export default function Segments() {
  const [items, setItems] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [minEngagement, setMinEngagement] = useState("");
  const [maxChurn, setMaxChurn] = useState("");
  const [segmentLabel, setSegmentLabel] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("ac_segments" as any)
      .select("id,name,description,filter,contact_count,last_computed_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name) return toast.error("Name erforderlich");
    const filter: Record<string, any> = {};
    if (minEngagement) filter.min_engagement = Number(minEngagement);
    if (maxChurn) filter.max_churn = Number(maxChurn);
    if (segmentLabel) filter.segment_label = segmentLabel;

    const { data: user } = await supabase.auth.getUser();
    const { data: seg, error } = await supabase.from("ac_segments" as any)
      .insert({ name, description: description || null, filter, created_by: user.user?.id })
      .select("id").single();
    if (error) return toast.error(error.message);

    await supabase.functions.invoke("ac-segment-preview", { body: { segment_id: (seg as any).id } });
    toast.success("Segment gespeichert");
    setName(""); setDescription(""); setMinEngagement(""); setMaxChurn(""); setSegmentLabel("");
    load();
  }

  async function recompute(id: string) {
    const { error } = await supabase.functions.invoke("ac-segment-preview", { body: { segment_id: id } });
    if (error) return toast.error(error.message);
    toast.success("Neu berechnet"); load();
  }
  async function remove(id: string) {
    if (!confirm("Segment löschen?")) return;
    const { error } = await supabase.from("ac_segments" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Gelöscht"); load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Layers className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-semibold">Segmente</h2>
          <p className="text-sm text-muted-foreground">Zielgruppen aus Customer-Scores für Kampagnen und Journeys.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Neues Segment</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Champions DE" /></div>
          <div><Label>Beschreibung</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label>Min. Engagement (0–100)</Label><Input type="number" value={minEngagement} onChange={(e) => setMinEngagement(e.target.value)} /></div>
          <div><Label>Max. Churn (0–100)</Label><Input type="number" value={maxChurn} onChange={(e) => setMaxChurn(e.target.value)} /></div>
          <div><Label>Segment-Label</Label><Input value={segmentLabel} onChange={(e) => setSegmentLabel(e.target.value)} placeholder="Champion / Active / At Risk / Dormant" /></div>
          <div className="flex items-end"><Button onClick={create}><Plus className="h-4 w-4 mr-2" />Speichern & Berechnen</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Segmente ({items.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Lade…</p> : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Segmente.</p>
          ) : (
            <div className="space-y-2">
              {items.map((s) => (
                <div key={s.id} className="flex items-start justify-between rounded-md border border-border/50 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{s.name}</span>
                      <Badge variant="secondary" className="text-[10px]"><Users className="h-3 w-3 mr-1" />{s.contact_count} Kontakte</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{s.description ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 font-mono">{JSON.stringify(s.filter)}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => recompute(s.id)}><RefreshCw className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
