import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarClock, Wrench, AlertTriangle, CheckCircle2 } from "lucide-react";

type Row = {
  id: string;
  serial_number: string;
  device_name: string | null;
  customer_name: string | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  maintenance_status: string;
  assigned_technician: string | null;
  notes: string | null;
};

const STATI = ["Geplant", "Termin vereinbart", "In Bearbeitung", "Abgeschlossen", "Überfällig"];

export default function Wartungscenter() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("device_maintenance")
      .select("id, serial_number, device_name, customer_name, last_maintenance_date, next_maintenance_date, maintenance_status, assigned_technician, notes")
      .order("next_maintenance_date", { ascending: true, nullsFirst: false })
      .limit(1000);
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const kpis = useMemo(() => ({
    today: rows.filter((r) => r.next_maintenance_date === today).length,
    week: rows.filter((r) => r.next_maintenance_date && r.next_maintenance_date >= today && r.next_maintenance_date <= in7).length,
    overdue: rows.filter((r) => r.maintenance_status === "Überfällig").length,
    upcoming: rows.filter((r) => r.next_maintenance_date && r.next_maintenance_date > in7).length,
  }), [rows, today, in7]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterStatus !== "all" && r.maintenance_status !== filterStatus) return false;
      if (!s) return true;
      return [r.serial_number, r.device_name, r.customer_name].some((v) => (v ?? "").toLowerCase().includes(s));
    });
  }, [rows, q, filterStatus]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("device_maintenance").update({ maintenance_status: status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status aktualisiert");
    load();
  };

  const exportCsv = () => {
    const head = ["Seriennummer", "Gerät", "Kunde", "Letzte Wartung", "Nächste Wartung", "Status"];
    const lines = [head.join(";")].concat(
      filtered.map((r) => [r.serial_number, r.device_name ?? "", r.customer_name ?? "", r.last_maintenance_date ?? "", r.next_maintenance_date ?? "", r.maintenance_status].join(";"))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `wartungen-${today}.csv`;
    a.click();
  };

  const badge = (s: string) => {
    const v: Record<string, string> = {
      "Abgeschlossen": "bg-green-500/15 text-green-500 border-green-500/30",
      "Überfällig": "bg-red-500/15 text-red-500 border-red-500/30",
      "In Bearbeitung": "bg-amber-500/15 text-amber-500 border-amber-500/30",
      "Termin vereinbart": "bg-blue-500/15 text-blue-500 border-blue-500/30",
      "Geplant": "bg-muted text-foreground border-border",
    };
    return <Badge variant="outline" className={v[s] ?? ""}>{s}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Wrench className="h-7 w-7 text-primary" /> Wartungscenter</h1>
          <p className="text-muted-foreground mt-1">Plant, terminiert und überwacht alle Gerätewartungen.</p>
        </div>
        <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi icon={<CalendarClock className="h-5 w-5" />} title="Heute" value={kpis.today} />
        <Kpi icon={<CalendarClock className="h-5 w-5" />} title="Diese Woche" value={kpis.week} />
        <Kpi icon={<AlertTriangle className="h-5 w-5 text-red-500" />} title="Überfällig" value={kpis.overdue} />
        <Kpi icon={<CheckCircle2 className="h-5 w-5 text-primary" />} title="Bevorstehend" value={kpis.upcoming} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Geplante Wartungen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Suche Seriennummer / Gerät / Kunde…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
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
                  <TableHead>Letzte Wartung</TableHead>
                  <TableHead>Nächste Wartung</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Lade…</TableCell></TableRow>}
                {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Keine Wartungen gefunden.</TableCell></TableRow>}
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.serial_number}</TableCell>
                    <TableCell>{r.device_name ?? "—"}</TableCell>
                    <TableCell>{r.customer_name ?? "—"}</TableCell>
                    <TableCell>{r.last_maintenance_date ?? "—"}</TableCell>
                    <TableCell>{r.next_maintenance_date ?? "—"}</TableCell>
                    <TableCell>{badge(r.maintenance_status)}</TableCell>
                    <TableCell>
                      <Select value={r.maintenance_status} onValueChange={(v) => setStatus(r.id, v)}>
                        <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATI.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
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
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className="text-primary">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
