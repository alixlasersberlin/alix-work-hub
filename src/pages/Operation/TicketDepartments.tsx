import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  name: string;
  slug: string;
  color: string;
  is_active: boolean;
  sort_order: number;
  allow_customer_pick_person: boolean;
  routing_strategy: "manual" | "round_robin" | "region" | "product" | "account_manager" | "least_load";
  mailbox_email: string | null;
  description: string | null;
  sla_hours: number;
  reminder_after_days: number;
};

const STRATEGIES: Row["routing_strategy"][] = [
  "least_load", "round_robin", "manual", "region", "product", "account_manager",
];
const STRATEGY_LABEL: Record<Row["routing_strategy"], string> = {
  least_load: "Geringste Auslastung",
  round_robin: "Round-Robin",
  manual: "Manuell",
  region: "Nach Region",
  product: "Nach Produkt",
  account_manager: "Fester Kundenbetreuer",
};

export default function TicketDepartments() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ticket_departments")
      .select("*")
      .order("sort_order");
    if (error) toast.error(error.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async (r: Row) => {
    setSaving(r.id);
    const { error } = await supabase.from("ticket_departments").update({
      name: r.name,
      slug: r.slug,
      color: r.color,
      is_active: r.is_active,
      sort_order: r.sort_order,
      allow_customer_pick_person: r.allow_customer_pick_person,
      routing_strategy: r.routing_strategy,
      mailbox_email: r.mailbox_email,
      description: r.description,
      sla_hours: r.sla_hours,
      reminder_after_days: r.reminder_after_days,
    }).eq("id", r.id);
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success("Gespeichert");
  };

  const remove = async (id: string) => {
    if (!confirm("Abteilung wirklich löschen?")) return;
    const { error } = await supabase.from("ticket_departments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Gelöscht");
    load();
  };

  const create = async () => {
    const name = prompt("Name der neuen Abteilung?");
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { error } = await supabase.from("ticket_departments").insert({
      name, slug, color: "#64748B", sort_order: 500, routing_strategy: "least_load",
    });
    if (error) return toast.error(error.message);
    load();
  };

  const patch = (id: string, patch: Partial<Row>) =>
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ticket-Abteilungen</h1>
          <p className="text-sm text-muted-foreground">
            Steuert Routing, Farben und Sichtbarkeit im Kundenportal.
          </p>
        </div>
        <Button onClick={create}><Plus className="w-4 h-4 mr-2" />Neu</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="grid gap-4">
          {rows.map(r => (
            <Card key={r.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-3">
                  <span className="inline-block w-4 h-4 rounded" style={{ background: r.color }} />
                  {r.name}
                  {!r.is_active && <Badge variant="secondary">Inaktiv</Badge>}
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button size="sm" onClick={() => save(r)} disabled={saving === r.id}>
                    {saving === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Speichern
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>Name</Label>
                  <Input value={r.name} onChange={e => patch(r.id, { name: e.target.value })} />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input value={r.slug} onChange={e => patch(r.id, { slug: e.target.value })} />
                </div>
                <div>
                  <Label>Farbe</Label>
                  <div className="flex gap-2">
                    <Input type="color" value={r.color} onChange={e => patch(r.id, { color: e.target.value })} className="w-16 p-1 h-10" />
                    <Input value={r.color} onChange={e => patch(r.id, { color: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Routing-Strategie</Label>
                  <Select value={r.routing_strategy} onValueChange={v => patch(r.id, { routing_strategy: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STRATEGIES.map(s => <SelectItem key={s} value={s}>{STRATEGY_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Postfach-E-Mail</Label>
                  <Input value={r.mailbox_email ?? ""} onChange={e => patch(r.id, { mailbox_email: e.target.value })} />
                </div>
                <div>
                  <Label>SLA (Stunden bis Reaktion)</Label>
                  <Input type="number" min={1} value={r.sla_hours ?? 24} onChange={e => patch(r.id, { sla_hours: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Kunden-Reminder (Tage)</Label>
                  <Input type="number" min={1} value={r.reminder_after_days ?? 3} onChange={e => patch(r.id, { reminder_after_days: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Sortierung</Label>
                  <Input type="number" value={r.sort_order} onChange={e => patch(r.id, { sort_order: Number(e.target.value) })} />
                </div>
                <div className="flex items-center gap-3 mt-6">
                  <Switch checked={r.is_active} onCheckedChange={v => patch(r.id, { is_active: v })} />
                  <Label>Aktiv</Label>
                </div>
                <div className="flex items-center gap-3 mt-6">
                  <Switch checked={r.allow_customer_pick_person} onCheckedChange={v => patch(r.id, { allow_customer_pick_person: v })} />
                  <Label>Kunde darf Ansprechpartner wählen</Label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
