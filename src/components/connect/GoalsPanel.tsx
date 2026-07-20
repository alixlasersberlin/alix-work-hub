import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Target, Plus, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

type Goal = {
  id: string; name: string; description: string | null;
  goal_type: "pageview" | "event" | "duration" | "scroll" | "outbound";
  match_mode: "equals" | "contains" | "starts_with" | "regex";
  match_pattern: string | null; event_name: string | null;
  threshold_value: number | null; value_cents: number; is_active: boolean;
};
type Summary = { goal_id: string; name: string; goal_type: string; conversions: number; unique_visitors: number; revenue_cents: number; conversion_rate: number };

const TYPE_LABEL: Record<Goal["goal_type"], string> = {
  pageview: "Seitenaufruf", event: "Custom Event", duration: "Verweildauer", scroll: "Scroll-Tiefe", outbound: "Outbound-Klick",
};

export default function GoalsPanel({ websiteId, from, to }: { websiteId: string; from: Date; to: Date }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Goal>>({ goal_type: "pageview", match_mode: "contains", value_cents: 0, is_active: true });

  async function load() {
    const [{ data: g }, { data: s }] = await Promise.all([
      supabase.from("ac_web_goals").select("*").eq("website_id", websiteId).order("created_at", { ascending: false }),
      supabase.rpc("ac_web_goals_summary", { _website_id: websiteId, _from: from.toISOString(), _to: to.toISOString() }),
    ]);
    setGoals((g as any[]) ?? []);
    setSummary((s as any[]) ?? []);
  }
  useEffect(() => { load(); }, [websiteId, from.getTime(), to.getTime()]);

  async function save() {
    if (!draft.name) { toast.error("Name fehlt"); return; }
    if (draft.goal_type !== "duration" && draft.goal_type !== "scroll" && !draft.match_pattern && draft.goal_type !== "event") {
      toast.error("Muster fehlt"); return;
    }
    if (draft.goal_type === "event" && !draft.event_name) { toast.error("Event-Name fehlt"); return; }
    const { error } = await supabase.from("ac_web_goals").insert({
      website_id: websiteId,
      name: draft.name!, description: draft.description ?? null,
      goal_type: draft.goal_type!, match_mode: draft.match_mode!,
      match_pattern: draft.match_pattern ?? null, event_name: draft.event_name ?? null,
      threshold_value: draft.threshold_value ?? null,
      value_cents: Math.round(Number(draft.value_cents ?? 0)),
      is_active: draft.is_active ?? true,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Ziel angelegt");
    setDraft({ goal_type: "pageview", match_mode: "contains", value_cents: 0, is_active: true });
    setOpen(false); load();
  }

  async function toggle(id: string, v: boolean) {
    await supabase.from("ac_web_goals").update({ is_active: v }).eq("id", id);
    load();
  }
  async function remove(id: string) {
    if (!confirm("Ziel wirklich löschen?")) return;
    await supabase.from("ac_web_goals").delete().eq("id", id);
    load();
  }

  const totalConv = summary.reduce((s, r) => s + Number(r.conversions || 0), 0);
  const totalRev = summary.reduce((s, r) => s + Number(r.revenue_cents || 0), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Ziele & Conversions</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalConv} Konversionen · {(totalRev / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })} Umsatz im Zeitraum
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Ziel</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Neues Ziel</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Name (z. B. Kontaktformular abgeschickt)" value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Select value={draft.goal_type} onValueChange={(v) => setDraft({ ...draft, goal_type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABEL) as Goal["goal_type"][]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Wert in Cent (optional)" value={draft.value_cents ?? 0} onChange={(e) => setDraft({ ...draft, value_cents: Number(e.target.value) })} />
              </div>
              {draft.goal_type === "event" && (
                <Input placeholder="Event-Name (z. B. form_submit)" value={draft.event_name ?? ""} onChange={(e) => setDraft({ ...draft, event_name: e.target.value })} />
              )}
              {(draft.goal_type === "pageview" || draft.goal_type === "outbound") && (
                <div className="grid grid-cols-3 gap-2">
                  <Select value={draft.match_mode} onValueChange={(v) => setDraft({ ...draft, match_mode: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">enthält</SelectItem>
                      <SelectItem value="equals">gleich</SelectItem>
                      <SelectItem value="starts_with">beginnt mit</SelectItem>
                      <SelectItem value="regex">regex</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input className="col-span-2" placeholder="/danke  oder  mailto:" value={draft.match_pattern ?? ""} onChange={(e) => setDraft({ ...draft, match_pattern: e.target.value })} />
                </div>
              )}
              {(draft.goal_type === "duration" || draft.goal_type === "scroll") && (
                <Input type="number" placeholder={draft.goal_type === "duration" ? "Sekunden (z. B. 60)" : "Prozent (z. B. 75)"} value={draft.threshold_value ?? ""} onChange={(e) => setDraft({ ...draft, threshold_value: Number(e.target.value) })} />
              )}
              <Input placeholder="Beschreibung (optional)" value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={save}>Anlegen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ziel</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead className="text-right">Konv.</TableHead>
              <TableHead className="text-right">Unique</TableHead>
              <TableHead className="text-right">CR</TableHead>
              <TableHead className="text-right">Umsatz</TableHead>
              <TableHead className="text-right">Aktiv</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {goals.map((g) => {
              const s = summary.find((x) => x.goal_id === g.id);
              return (
                <TableRow key={g.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{g.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[280px]">
                      {g.goal_type === "event" ? `event: ${g.event_name}` :
                        g.goal_type === "scroll" ? `≥ ${g.threshold_value}%` :
                        g.goal_type === "duration" ? `≥ ${g.threshold_value}s` :
                        `${g.match_mode}: ${g.match_pattern}`}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{TYPE_LABEL[g.goal_type]}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{s?.conversions ?? 0}</TableCell>
                  <TableCell className="text-right">{s?.unique_visitors ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1 text-xs">
                      <TrendingUp className="h-3 w-3 text-primary" />{Number(s?.conversion_rate ?? 0).toFixed(2)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {((Number(s?.revenue_cents ?? 0)) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                  </TableCell>
                  <TableCell className="text-right"><Switch checked={g.is_active} onCheckedChange={(v) => toggle(g.id, v)} /></TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => remove(g.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {goals.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-sm">
                Noch keine Ziele. Lege z. B. „Danke-Seite" (Pageview enthält <code>/danke</code>) an.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
