import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Wrench, AlertTriangle, Clock, CalendarClock, MapPin, Mail, ListChecks, Cog } from "lucide-react";

type Row = {
  id: string;
  serial_number: string;
  device_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  next_maintenance_date: string | null;
  last_maintenance_date: string | null;
  maintenance_status: string;
  maintenance_plan_id: string | null;
  route_plan_id: string | null;
  service_address: any;
};

const STATI = ["Nicht fällig", "Bald fällig", "Fällig", "Überfällig", "Geplant", "In Bearbeitung", "Abgeschlossen", "Verschoben", "Abgelehnt"];

function statusOf(r: Row, today: string, soon: string): string {
  if (r.maintenance_status && ["Abgeschlossen", "Verschoben", "Abgelehnt", "In Bearbeitung"].includes(r.maintenance_status)) return r.maintenance_status;
  if (!r.next_maintenance_date) return "Nicht fällig";
  if (r.next_maintenance_date < today) return "Überfällig";
  if (r.next_maintenance_date === today) return "Fällig";
  if (r.next_maintenance_date <= soon) return "Bald fällig";
  return "Nicht fällig";
}

export default function Wartungsmanagement() {
  const [rows, setRows] = useState<Row[]>([]);
  const [plans, setPlans] = useState<number>(0);
  const [unplanned, setUnplanned] = useState<number>(0);
  const [highRisk, setHighRisk] = useState<number>(0);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const monthEnd = new Date(); monthEnd.setMonth(monthEnd.getMonth() + 1);
  const in30 = monthEnd.toISOString().slice(0, 10);

  const load = async () => {
    const [{ data: dm }, { count: pCount }, { count: hr }, { data: lager }] = await Promise.all([
      supabase.from("device_maintenance").select("id, serial_number, device_name, customer_id, customer_name, customer_email, next_maintenance_date, last_maintenance_date, maintenance_status, maintenance_plan_id, route_plan_id, service_address").order("next_maintenance_date", { ascending: true, nullsFirst: false }).limit(1000),
      supabase.from("maintenance_plans").select("id", { count: "exact", head: true }),
      supabase.from("device_health_scores").select("serial_number", { count: "exact", head: true }).eq("health_status", "rot"),
      supabase.from("lager_devices").select("serial_number").not("reserved_order_id", "is", null).limit(2000),
    ]);
    setRows((dm as Row[]) ?? []);
    setPlans(pCount ?? 0);
    setHighRisk(hr ?? 0);
    const sold = new Set((lager ?? []).map((x: any) => x.serial_number));
    const planned = new Set((dm ?? []).map((x: any) => x.serial_number));
    setUnplanned([...sold].filter((s) => !planned.has(s)).length);
  };

  useEffect(() => { load(); }, []);

  const kpis = useMemo(() => {
    const due = rows.filter((r) => statusOf(r, today, in14) === "Fällig").length;
    const soon = rows.filter((r) => statusOf(r, today, in14) === "Bald fällig").length;
    const over = rows.filter((r) => statusOf(r, today, in14) === "Überfällig").length;
    const week = rows.filter((r) => r.next_maintenance_date && r.next_maintenance_date >= today && r.next_maintenance_date <= in7).length;
    const month = rows.filter((r) => r.next_maintenance_date && r.next_maintenance_date >= today && r.next_maintenance_date <= in30).length;
    return { due, soon, over, week, month };
  }, [rows, today, in7, in14, in30]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      const st = statusOf(r, today, in14);
      if (filter !== "all" && st !== filter && r.maintenance_status !== filter) return false;
      if (!s) return true;
      return [r.serial_number, r.device_name, r.customer_name].some((v) => (v ?? "").toLowerCase().includes(s));
    });
  }, [rows, q, filter, today, in14]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("device_maintenance").update({ maintenance_status: status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status aktualisiert"); load();
  };

  const sendReminder = async (r: Row) => {
    if (!r.customer_email) return toast.error("Keine Kunden-E-Mail hinterlegt");
    const due = r.next_maintenance_date ?? today;
    const type = due < today ? "overdue" : due === today ? "due" : due <= in14 ? "14d" : "30d";
    try {
      const { error } = await supabase.functions.invoke("ticket-customer-notify", {
        body: {
          event: "maintenance_reminder",
          recipient_email: r.customer_email,
          customer_name: r.customer_name,
          message: `Wartungserinnerung für Ihr Gerät ${r.device_name ?? ""} (SN ${r.serial_number}). Geplanter Termin: ${due}.`,
        },
      });
      if (error) throw error;
      await supabase.from("maintenance_reminder_log").insert({
        device_maintenance_id: r.id, serial_number: r.serial_number, device_name: r.device_name,
        customer_id: r.customer_id, customer_name: r.customer_name, recipient_email: r.customer_email,
        reminder_type: type, due_date: due, status: "sent",
      });
      toast.success("Erinnerung gesendet");
    } catch (e: any) { toast.error(e.message ?? "Versand fehlgeschlagen"); }
  };

  const createTourDraft = async (r: Row) => {
    setBusy(true);
    try {
      const due = r.next_maintenance_date ?? today;
      const prio = due < today ? "Hoch" : due === today ? "Hoch" : due <= in7 ? "Mittel" : "Normal";
      const { data: rp, error } = await supabase.from("route_plans").insert({
        tour_type: "Wartung",
        planning_status: "Entwurf",
        priority: prio,
        planned_date: due,
        customer_id: r.customer_id,
        device_serial_number: r.serial_number,
        device_model: r.device_name,
        contact_email: r.customer_email,
        contact_name: r.customer_name,
        location_address: r.service_address ?? null,
        planning_note: `Wartung aus Wartungsmanagement (Wartungs-ID ${r.id})`,
      } as any).select("id").single();
      if (error) throw error;
      await supabase.from("device_maintenance").update({ route_plan_id: rp.id, maintenance_status: "Geplant" }).eq("id", r.id);
      toast.success("Tourenvorschlag erstellt");
      load();
    } catch (e: any) { toast.error(e.message ?? "Tour konnte nicht erstellt werden"); }
    finally { setBusy(false); }
  };

  const runDaily = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("maintenance-reminder-daily", { body: {} });
      if (error) throw error;
      toast.success(`Erinnerungsjob: gesendet ${data?.sent ?? 0}, übersprungen ${data?.skipped ?? 0}, Fehler ${data?.failed ?? 0}`);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const badge = (s: string) => {
    const v: Record<string, string> = {
      "Abgeschlossen": "bg-green-500/15 text-green-500 border-green-500/30",
      "Überfällig": "bg-red-500/15 text-red-500 border-red-500/30",
      "Fällig": "bg-amber-500/15 text-amber-500 border-amber-500/30",
      "Bald fällig": "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
      "In Bearbeitung": "bg-blue-500/15 text-blue-500 border-blue-500/30",
      "Geplant": "bg-primary/15 text-primary border-primary/30",
    };
    return <Badge variant="outline" className={v[s] ?? ""}>{s}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Cog className="h-7 w-7 text-primary" /> Wartungsmanagement</h1>
          <p className="text-muted-foreground mt-1">Plant, terminiert und überwacht alle Gerätewartungen inkl. automatischer Erinnerungen.</p>
        </div>
        <Button onClick={runDaily} disabled={busy}><Mail className="h-4 w-4 mr-2" /> Tägliche Erinnerungen jetzt senden</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Kpi icon={<AlertTriangle className="h-5 w-5 text-red-500" />} title="Überfällig" value={kpis.over} />
        <Kpi icon={<Clock className="h-5 w-5 text-amber-500" />} title="Fällig" value={kpis.due} />
        <Kpi icon={<CalendarClock className="h-5 w-5" />} title="Bald fällig" value={kpis.soon} />
        <Kpi icon={<CalendarClock className="h-5 w-5" />} title="Diese Woche" value={kpis.week} />
        <Kpi icon={<CalendarClock className="h-5 w-5" />} title="Diesen Monat" value={kpis.month} />
        <Kpi icon={<ListChecks className="h-5 w-5" />} title="Ohne Plan" value={unplanned} />
        <Kpi icon={<AlertTriangle className="h-5 w-5" />} title="Ausfallrisiko" value={highRisk} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wartungen ({filtered.length} / Pläne: {plans})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Suche Seriennummer / Gerät / Kunde…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {STATI.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seriennummer</TableHead>
                  <TableHead>Gerät</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Letzte</TableHead>
                  <TableHead>Nächste</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Keine Wartungen.</TableCell></TableRow>}
                {filtered.map((r) => {
                  const st = statusOf(r, today, in14);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.serial_number}</TableCell>
                      <TableCell>{r.device_name ?? "—"}</TableCell>
                      <TableCell>{r.customer_name ?? "—"}</TableCell>
                      <TableCell>{r.last_maintenance_date ?? "—"}</TableCell>
                      <TableCell>{r.next_maintenance_date ?? "—"}</TableCell>
                      <TableCell>{badge(st)}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="outline" onClick={() => sendReminder(r)} disabled={!r.customer_email}><Mail className="h-3 w-3 mr-1" />Erinnern</Button>
                        <Button size="sm" variant="outline" onClick={() => createTourDraft(r)} disabled={busy || !!r.route_plan_id}><MapPin className="h-3 w-3 mr-1" />{r.route_plan_id ? "Tour ✓" : "Tour"}</Button>
                        <Select value={r.maintenance_status} onValueChange={(v) => setStatus(r.id, v)}>
                          <SelectTrigger className="w-40 h-8 inline-flex"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATI.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon, title, value }: { icon: React.ReactNode; title: string; value: number }) {
  return (
    <Card><CardContent className="pt-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className="text-primary">{icon}</div>
      </div>
    </CardContent></Card>
  );
}
