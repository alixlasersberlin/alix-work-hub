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
import { Bell, Plus, Trash2, Send } from "lucide-react";
import { toast } from "sonner";

type Kind = "no_traffic" | "visitor_spike" | "goal_completed" | "daily_summary";
const KIND_LABEL: Record<Kind, string> = {
  no_traffic: "Kein Traffic",
  visitor_spike: "Besucher-Spike",
  goal_completed: "Ziel erreicht",
  daily_summary: "Tageszusammenfassung",
};

type Alert = {
  id: string; name: string; kind: Kind;
  threshold: number; window_minutes: number; cooldown_minutes: number;
  recipient_email: string; goal_id: string | null;
  is_active: boolean; last_triggered_at: string | null;
};

export default function AlertsPanel({ websiteId }: { websiteId: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Alert>>({
    kind: "no_traffic", threshold: 0, window_minutes: 60, cooldown_minutes: 240, is_active: true,
  });
  const [running, setRunning] = useState(false);

  async function load() {
    const { data } = await supabase.from("ac_web_alerts" as any).select("*")
      .eq("website_id", websiteId).order("created_at", { ascending: false });
    setAlerts((data as any) ?? []);
  }
  useEffect(() => { load(); }, [websiteId]);

  async function save() {
    if (!draft.name || !draft.recipient_email) { toast.error("Name & E-Mail erforderlich"); return; }
    const { error } = await supabase.from("ac_web_alerts" as any).insert({
      website_id: websiteId,
      name: draft.name, kind: draft.kind, threshold: draft.threshold ?? 0,
      window_minutes: draft.window_minutes ?? 60, cooldown_minutes: draft.cooldown_minutes ?? 240,
      recipient_email: draft.recipient_email, is_active: draft.is_active ?? true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Alarm angelegt");
    setOpen(false); setDraft({ kind: "no_traffic", threshold: 0, window_minutes: 60, cooldown_minutes: 240, is_active: true });
    load();
  }

  async function toggle(id: string, is_active: boolean) {
    await supabase.from("ac_web_alerts" as any).update({ is_active }).eq("id", id);
    load();
  }
  async function remove(id: string) {
    if (!confirm("Alarm löschen?")) return;
    await supabase.from("ac_web_alerts" as any).delete().eq("id", id);
    load();
  }
  async function runNow() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ac-alerts-check", { body: {} });
      if (error) throw error;
      toast.success(`Geprüft: ${(data as any)?.checked ?? 0} Alarme`);
      load();
    } catch (e: any) { toast.error(e.message || "Fehler"); }
    finally { setRunning(false); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><Bell className="h-4 w-4" /> E-Mail-Alerts</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={runNow} disabled={running}>
            <Send className="h-3.5 w-3.5 mr-1" /> Jetzt prüfen
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Alarm</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neuer Alarm</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Name" value={draft.name ?? ""} onChange={e => setDraft({ ...draft, name: e.target.value })} />
                <Select value={draft.kind} onValueChange={(v: Kind) => setDraft({ ...draft, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(KIND_LABEL) as Kind[]).map(k => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Schwellwert</label>
                    <Input type="number" value={draft.threshold ?? 0} onChange={e => setDraft({ ...draft, threshold: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Fenster (min)</label>
                    <Input type="number" value={draft.window_minutes ?? 60} onChange={e => setDraft({ ...draft, window_minutes: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Cooldown (min)</label>
                    <Input type="number" value={draft.cooldown_minutes ?? 240} onChange={e => setDraft({ ...draft, cooldown_minutes: Number(e.target.value) })} />
                  </div>
                </div>
                <Input type="email" placeholder="Empfänger E-Mail" value={draft.recipient_email ?? ""} onChange={e => setDraft({ ...draft, recipient_email: e.target.value })} />
                <p className="text-xs text-muted-foreground">
                  <strong>Kein Traffic:</strong> Events ≤ Schwellwert im Fenster.<br/>
                  <strong>Spike:</strong> Unique-Besucher ≥ Schwellwert.<br/>
                  <strong>Ziel erreicht:</strong> Conversions ≥ Schwellwert.<br/>
                  <strong>Tageszusammenfassung:</strong> täglich ab 08:00 CEST.
                </p>
              </div>
              <DialogFooter><Button onClick={save}>Speichern</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Typ</TableHead><TableHead>Schwelle</TableHead>
              <TableHead>Fenster</TableHead><TableHead>Empfänger</TableHead>
              <TableHead>Zuletzt gesendet</TableHead><TableHead>Aktiv</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell><Badge variant="outline">{KIND_LABEL[a.kind]}</Badge></TableCell>
                <TableCell>{a.threshold}</TableCell>
                <TableCell>{a.window_minutes} min</TableCell>
                <TableCell className="text-xs">{a.recipient_email}</TableCell>
                <TableCell className="text-xs">{a.last_triggered_at ? new Date(a.last_triggered_at).toLocaleString("de-DE") : "–"}</TableCell>
                <TableCell><Switch checked={a.is_active} onCheckedChange={v => toggle(a.id, v)} /></TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => remove(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}
            {alerts.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-sm">Noch keine Alarme.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
