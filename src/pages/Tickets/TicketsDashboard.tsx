import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, Inbox, User, Clock, AlertTriangle, CalendarDays,
  PauseCircle, Flame, RefreshCw, ArrowRight, Activity, Layers, Gauge,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { de } from "date-fns/locale";

type Counts = {
  neu: number; meine: number; heute: number; ueberfaellig: number;
  termine_heute: number; warten_kunde: number; eskaliert: number; total_offen: number;
  sla_warning: number; sla_breach: number;
};

const OPEN_STATUS = ["open", "offen", "in-progress", "in_bearbeitung", "wartet_kunde", "wartet_Kunde", "Neu", "Zugewiesen", "In Bearbeitung"];
const CLOSED_STATUS = ["geschlossen", "closed", "gelöst", "Geschlossen", "Erledigt"];
const PRIO_COLORS: Record<string, string> = {
  kritisch: "hsl(0 84% 60%)",
  dringend: "hsl(14 90% 55%)",
  hoch: "hsl(38 92% 55%)",
  normal: "hsl(217 91% 60%)",
  niedrig: "hsl(215 15% 55%)",
};
const DEPT_PALETTE = [
  "hsl(217 91% 60%)", "hsl(160 84% 45%)", "hsl(280 70% 60%)", "hsl(38 92% 55%)",
  "hsl(0 84% 60%)", "hsl(190 90% 45%)", "hsl(260 70% 60%)", "hsl(120 60% 45%)",
];

type HistoryRow = {
  id: string;
  ticket_id: string;
  action: string | null;
  field: string | null;
  new_value: string | null;
  created_at: string;
};

export default function TicketsDashboard() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [prioData, setPrioData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [deptData, setDeptData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [trendData, setTrendData] = useState<{ date: string; neu: number; geschlossen: number }[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const start = startOfDay(now).toISOString();
    const end = endOfDay(now).toISOString();
    const c = (q: any) => q.then((r: any) => r.count ?? 0);

    const [neu, meine, heute, ueberfaellig, termine_heute, warten_kunde, eskaliert, total_offen, sla_warning, sla_breach] = await Promise.all([
      c(supabase.from("tickets").select("id", { count: "exact", head: true }).in("status", ["open", "offen", "Neu"])),
      c(supabase.from("tickets").select("id", { count: "exact", head: true })
        .eq("assigned_to", user?.id ?? "").in("status", OPEN_STATUS)),
      c(supabase.from("tickets").select("id", { count: "exact", head: true })
        .gte("due_at", start).lt("due_at", end).in("status", OPEN_STATUS)),
      c(supabase.from("tickets").select("id", { count: "exact", head: true })
        .lt("due_at", now.toISOString()).in("status", OPEN_STATUS)),
      c(supabase.from("tickets").select("id", { count: "exact", head: true })
        .gte("appointment_at", start).lt("appointment_at", end)),
      c(supabase.from("tickets").select("id", { count: "exact", head: true }).in("status", ["wartet_kunde", "wartet_Kunde", "Warten auf Kunde"])),
      c(supabase.from("tickets").select("id", { count: "exact", head: true }).gt("escalation_count", 0).in("status", OPEN_STATUS)),
      c(supabase.from("tickets").select("id", { count: "exact", head: true }).in("status", OPEN_STATUS)),
      c(supabase.from("tickets").select("id", { count: "exact", head: true }).in("sla_status", ["warning", "warn_response", "warn_progress"]).in("status", OPEN_STATUS)),
      c(supabase.from("tickets").select("id", { count: "exact", head: true }).eq("sla_status", "breach").in("status", OPEN_STATUS)),
    ]);
    setCounts({ neu, meine, heute, ueberfaellig, termine_heute, warten_kunde, eskaliert, total_offen, sla_warning, sla_breach });

    // Priority breakdown (offene Tickets)
    const { data: prio } = await supabase
      .from("tickets").select("priority").in("status", OPEN_STATUS).limit(1000);
    const prioAgg: Record<string, number> = {};
    (prio ?? []).forEach((r: any) => {
      const k = r.priority ?? "Normal";
      prioAgg[k] = (prioAgg[k] ?? 0) + 1;
    });
    setPrioData(Object.entries(prioAgg)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value, color: PRIO_COLORS[name?.toLowerCase()] ?? "hsl(215 15% 55%)" })));

    // Department breakdown
    const { data: dept } = await supabase
      .from("tickets").select("department").in("status", OPEN_STATUS).limit(1000);
    const deptAgg: Record<string, number> = {};
    (dept ?? []).forEach((r: any) => {
      const k = r.department ?? "—";
      deptAgg[k] = (deptAgg[k] ?? 0) + 1;
    });
    setDeptData(Object.entries(deptAgg)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], i) => ({ name, value, color: DEPT_PALETTE[i % DEPT_PALETTE.length] })));

    // 14-Tage-Trend (created vs closed)
    const from14 = subDays(startOfDay(now), 13);
    const [{ data: created }, { data: closed }] = await Promise.all([
      supabase.from("tickets").select("created_at").gte("created_at", from14.toISOString()).limit(2000),
      supabase.from("tickets").select("updated_at").gte("updated_at", from14.toISOString()).in("status", CLOSED_STATUS).limit(2000),
    ]);
    const days: Record<string, { neu: number; geschlossen: number }> = {};
    for (let i = 0; i < 14; i++) {
      const k = format(subDays(now, 13 - i), "yyyy-MM-dd");
      days[k] = { neu: 0, geschlossen: 0 };
    }
    (created ?? []).forEach((r: any) => {
      const k = format(new Date(r.created_at), "yyyy-MM-dd");
      if (days[k]) days[k].neu++;
    });
    (closed ?? []).forEach((r: any) => {
      const k = format(new Date(r.updated_at), "yyyy-MM-dd");
      if (days[k]) days[k].geschlossen++;
    });
    setTrendData(Object.entries(days).map(([date, v]) => ({
      date: format(new Date(date), "dd.MM.", { locale: de }), ...v,
    })));

    // Recent activity
    const { data: hist } = await supabase
      .from("ticket_history")
      .select("id, ticket_id, action, field, new_value, created_at")
      .order("created_at", { ascending: false }).limit(15);
    setHistory((hist as any) ?? []);

    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const tile = (label: string, value: number, Icon: any, to: string, tone?: string) => (
    <Link to={to}>
      <Card className="hover:shadow-md hover:border-primary/30 transition">
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[12px] text-muted-foreground font-medium">{label}</CardTitle>
          <Icon className={`w-4 h-4 ${tone ?? "text-muted-foreground"}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-semibold ${tone ?? ""}`}>{value}</div>
        </CardContent>
      </Card>
    </Link>
  );

  const actionLabel = useMemo(() => ({
    auto_escalated: "Automatisch eskaliert",
    sla_breach: "SLA überschritten",
    phone_call_logged: "Telefonat dokumentiert",
    followup_due: "Wiedervorlage fällig",
    appointment_created: "Termin erstellt",
    appointment_email_sent: "Terminmail gesendet",
    appointment_confirmed: "Termin bestätigt",
    appointment_rescheduled: "Termin verschoben",
    appointment_cancelled: "Termin abgesagt",
    appointment_confirmation_expired: "Bestätigung abgelaufen",
    assigned: "Zugewiesen",
    routed: "Automatisch geroutet",
    status_changed: "Status geändert",
    created: "Erstellt",
  } as Record<string, string>), []);

  if (loading || !counts) {
    return <div className="p-6 flex justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Tickets-Übersicht</h1>
          <p className="text-sm text-muted-foreground">Alle offenen Tickets, Fristen und Termine auf einen Blick.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Link to="/tickets"><Badge variant="outline">Alle Tickets</Badge></Link>
          <Link to="/tickets/kalender"><Badge variant="outline">Ticket-Kalender</Badge></Link>
          <Link to="/esc/buchungen"><Badge variant="outline">Buchungen</Badge></Link>
          <Link to="/operation/ticket-abteilungen"><Badge variant="outline">Abteilungen</Badge></Link>
          <Button size="sm" variant="ghost" onClick={load}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {tile("Neue Tickets", counts.neu, Inbox, "/tickets?status=open")}
        {tile("Meine offenen", counts.meine, User, "/tickets?mine=1")}
        {tile("Heute fällig", counts.heute, Clock, "/tickets?due=today", counts.heute > 0 ? "text-amber-500" : undefined)}
        {tile("Überfällig", counts.ueberfaellig, AlertTriangle, "/tickets?due=overdue", counts.ueberfaellig > 0 ? "text-destructive" : undefined)}
        {tile("SLA-Warnung", counts.sla_warning, Clock, "/tickets?sla=warning", counts.sla_warning > 0 ? "text-amber-500" : undefined)}
        {tile("SLA-Breach", counts.sla_breach, AlertTriangle, "/tickets?sla=breach", counts.sla_breach > 0 ? "text-destructive" : undefined)}
        {tile("Termine heute", counts.termine_heute, CalendarDays, "/tickets/kalender")}
        {tile("Warten auf Kunde", counts.warten_kunde, PauseCircle, "/tickets?status=wartet_kunde")}
        {tile("Eskaliert", counts.eskaliert, Flame, "/tickets?escalated=1", counts.eskaliert > 0 ? "text-destructive" : undefined)}
        {tile("Offen gesamt", counts.total_offen, Gauge, "/tickets")}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Verlauf (14 Tage)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="neu" name="Neu" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="geschlossen" name="Geschlossen" stroke="hsl(160 84% 45%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Nach Priorität
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={prioData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {prioData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-1.5 mt-1 justify-center">
              {prioData.map((p) => (
                <div key={p.name} className="flex items-center gap-1 text-[11px]">
                  <span className="w-2 h-2 rounded-full" style={{ background: p.color }} /> {p.name} ({p.value})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Nach Abteilung
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData} layout="vertical" margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {deptData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Letzte Aktivitäten
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {history.length === 0 && (
              <li className="p-4 text-center text-muted-foreground text-[12px]">Keine Einträge</li>
            )}
            {history.map((h) => (
              <li key={h.id} className="px-4 py-2 flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge variant="secondary" className="text-[10px] whitespace-nowrap">
                    {actionLabel[h.action ?? ""] ?? h.action ?? "—"}
                  </Badge>
                  <span className="text-muted-foreground truncate">
                    {h.field && <span className="font-mono">{h.field}</span>}
                    {h.new_value && <span className="ml-2">→ {String(h.new_value).slice(0, 60)}</span>}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-muted-foreground">
                    {format(new Date(h.created_at), "dd.MM. HH:mm", { locale: de })}
                  </span>
                  <Link to={`/tickets/${h.ticket_id}`} className="text-primary hover:underline flex items-center gap-1">
                    Öffnen <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
