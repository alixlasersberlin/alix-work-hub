import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";

type Segment = { id: string; name: string; filters: Record<string, string> };
type Stat = { visitors: number; sessions: number; pageviews: number; conversions: number };

const FILTER_FIELDS = [
  { key: "country", label: "Land (ISO-2)" },
  { key: "device_type", label: "Gerät (desktop/mobile/tablet)" },
  { key: "browser", label: "Browser" },
  { key: "utm_source", label: "UTM Source" },
  { key: "utm_medium", label: "UTM Medium" },
  { key: "utm_campaign", label: "UTM Campaign" },
  { key: "page_ilike", label: "Seite enthält" },
];

export default function SegmentsPanel({ websiteId, from, to }: { websiteId: string; from: Date; to: Date }) {
  const [items, setItems] = useState<Segment[]>([]);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ name: string; filters: Record<string, string> }>({ name: "", filters: {} });

  async function load() {
    const { data } = await supabase.from("ac_web_segments").select("*").eq("website_id", websiteId).order("created_at", { ascending: false });
    const rows = (data as any as Segment[]) ?? [];
    setItems(rows);
    const map: Record<string, Stat> = {};
    await Promise.all(rows.map(async (s) => {
      const { data: st } = await supabase.rpc("ac_web_segment_stats", { _website_id: websiteId, _filters: s.filters as any, _from: from.toISOString(), _to: to.toISOString() });
      map[s.id] = ((st as any)?.[0]) ?? { visitors: 0, sessions: 0, pageviews: 0, conversions: 0 };
    }));
    setStats(map);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [websiteId, from.getTime(), to.getTime()]);

  async function save() {
    if (!draft.name.trim()) { toast.error("Name fehlt"); return; }
    const filters = Object.fromEntries(Object.entries(draft.filters).filter(([, v]) => v && v.trim()));
    const { error } = await supabase.from("ac_web_segments").insert({ website_id: websiteId, name: draft.name, filters: filters as any } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Segment angelegt");
    setOpen(false);
    setDraft({ name: "", filters: {} });
    load();
  }
  async function remove(id: string) {
    if (!confirm("Segment löschen?")) return;
    await supabase.from("ac_web_segments").delete().eq("id", id);
    load();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> Segmente</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Neu</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Segment anlegen</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Mobile DE, Google Ads" /></div>
              {FILTER_FIELDS.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}</Label>
                  <Input value={draft.filters[f.key] || ""} onChange={(e) => setDraft({ ...draft, filters: { ...draft.filters, [f.key]: e.target.value } })} placeholder="leer = ignorieren" />
                </div>
              ))}
            </div>
            <DialogFooter><Button onClick={save}>Speichern</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Segmente.</p>}
        {items.map((s) => {
          const st = stats[s.id];
          return (
            <div key={s.id} className="rounded-md border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{Object.entries(s.filters).map(([k, v]) => `${k}=${v}`).join(" · ") || "(alle)"}</div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div><span className="text-muted-foreground text-[10px] mr-1">Besucher</span>{st?.visitors ?? 0}</div>
                  <div><span className="text-muted-foreground text-[10px] mr-1">Sitzungen</span>{st?.sessions ?? 0}</div>
                  <div><span className="text-muted-foreground text-[10px] mr-1">Views</span>{st?.pageviews ?? 0}</div>
                  <div><span className="text-muted-foreground text-[10px] mr-1">Conv.</span>{st?.conversions ?? 0}</div>
                  <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
