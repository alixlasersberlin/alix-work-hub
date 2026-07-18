import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/infinity/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Download, TrendingUp, Users, Bell, Target, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type CustomerLink = {
  id: string;
  alixwork_customer_id: string;
  match_status: "registered" | "unregistered" | "possible" | "reminded";
  registered_at: string | null;
  last_reminder_at: string | null;
  created_at: string;
};

type Reminder = {
  id: string;
  customer_id: string;
  channel: string;
  status: string;
  sent_at: string | null;
  created_at: string;
};

type CustRow = {
  customer_id: string;
  customer_number: string | null;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  device_count: number;
  match_status: string;
  last_reminder_at: string | null;
};

const COLORS = ["#10b981", "#f43f5e", "#f59e0b", "#38bdf8"];

export default function AlixSmartAnalytics() {
  const [range, setRange] = useState<"30" | "90" | "180" | "365">("90");
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<CustomerLink[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [custs, setCusts] = useState<CustRow[]>([]);

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - Number(range) * 24 * 60 * 60 * 1000).toISOString();
    const [l, r, s] = await Promise.all([
      supabase.from("alixsmart_customer_links").select("id, alixwork_customer_id, match_status, registered_at, last_reminder_at, created_at").limit(5000),
      supabase.from("alixsmart_reminders").select("id, customer_id, channel, status, sent_at, created_at").gte("created_at", since).limit(5000),
      supabase.from("v_alixsmart_customer_status" as any).select("customer_id, customer_number, company_name, contact_name, email, device_count, match_status, last_reminder_at").limit(2000),
    ]);
    if (l.error) toast.error(l.error.message);
    if (r.error) toast.error(r.error.message);
    if (s.error) toast.error(s.error.message);
    setLinks((l.data as any) || []);
    setReminders((r.data as any) || []);
    setCusts((s.data as any) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [range]);

  // KPIs
  const kpis = useMemo(() => {
    const total = custs.length;
    const registered = custs.filter(c => c.match_status === "registered").length;
    const unregistered = custs.filter(c => c.match_status === "unregistered").length;
    const remindersSent = reminders.filter(r => r.status === "sent" || r.sent_at).length;
    // Wirksamkeit: wieviele haben sich nach Reminder registriert
    const remindedCustIds = new Set(reminders.filter(r => r.sent_at).map(r => r.customer_id));
    const convertedAfterReminder = links.filter(l =>
      remindedCustIds.has(l.alixwork_customer_id) &&
      l.registered_at && l.last_reminder_at &&
      new Date(l.registered_at) > new Date(l.last_reminder_at)
    ).length;
    const conversion = remindedCustIds.size > 0 ? (convertedAfterReminder / remindedCustIds.size) * 100 : 0;
    return { total, registered, unregistered, remindersSent, convertedAfterReminder, conversion };
  }, [custs, reminders, links]);

  // Registrierungs-Trend
  const trendData = useMemo(() => {
    const days = Number(range);
    const buckets: Record<string, { date: string; registered: number; cumulative: number }> = {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { date: key, registered: 0, cumulative: 0 };
    }
    links.filter(l => l.registered_at).forEach(l => {
      const key = l.registered_at!.slice(0, 10);
      if (buckets[key]) buckets[key].registered += 1;
    });
    let cum = 0;
    return Object.values(buckets).map(b => { cum += b.registered; return { ...b, cumulative: cum, dateLabel: new Date(b.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) }; });
  }, [links, range]);

  // Reminder-Wirksamkeit pro Kanal
  const reminderData = useMemo(() => {
    const byCh: Record<string, { channel: string; sent: number; converted: number }> = {};
    reminders.forEach(r => {
      const ch = r.channel || "unknown";
      if (!byCh[ch]) byCh[ch] = { channel: ch === "email" ? "E-Mail" : ch === "sms" ? "SMS" : ch, sent: 0, converted: 0 };
      if (r.sent_at) byCh[ch].sent += 1;
    });
    // Konvertierungen pro Kanal
    const linkMap = new Map(links.map(l => [l.alixwork_customer_id, l]));
    Object.keys(byCh).forEach(ch => {
      const custIds = new Set(reminders.filter(r => r.channel === ch && r.sent_at).map(r => r.customer_id));
      custIds.forEach(cid => {
        const l = linkMap.get(cid);
        if (l?.registered_at && l.last_reminder_at && new Date(l.registered_at) > new Date(l.last_reminder_at)) {
          byCh[ch].converted += 1;
        }
      });
    });
    return Object.values(byCh);
  }, [reminders, links]);

  // Status-Verteilung
  const statusData = useMemo(() => {
    const s = { Registriert: 0, "Nicht registriert": 0, Möglich: 0, Erinnert: 0 };
    custs.forEach(c => {
      if (c.match_status === "registered") s.Registriert++;
      else if (c.match_status === "unregistered") s["Nicht registriert"]++;
      else if (c.match_status === "possible") s["Möglich"]++;
      else if (c.match_status === "reminded") s.Erinnert++;
    });
    return Object.entries(s).map(([name, value]) => ({ name, value }));
  }, [custs]);

  // Top 20 Nicht-Registrierte nach Geräteanzahl
  const topUnregistered = useMemo(() => {
    return custs
      .filter(c => c.match_status === "unregistered")
      .sort((a, b) => b.device_count - a.device_count)
      .slice(0, 20);
  }, [custs]);

  function exportReport() {
    const lines: string[] = [];
    lines.push(`AlixSmart Analytics Report;${new Date().toLocaleString("de-DE")}`);
    lines.push(`Zeitraum;letzte ${range} Tage`);
    lines.push("");
    lines.push("KPI;Wert");
    lines.push(`Kunden mit Geräten;${kpis.total}`);
    lines.push(`Registriert;${kpis.registered}`);
    lines.push(`Nicht registriert;${kpis.unregistered}`);
    lines.push(`Registrierungsquote;${kpis.total ? ((kpis.registered / kpis.total) * 100).toFixed(1) : 0}%`);
    lines.push(`Reminder gesendet;${kpis.remindersSent}`);
    lines.push(`Nach Reminder registriert;${kpis.convertedAfterReminder}`);
    lines.push(`Reminder-Konversion;${kpis.conversion.toFixed(1)}%`);
    lines.push("");
    lines.push("Registrierungs-Trend");
    lines.push("Datum;Neu registriert;Kumulativ");
    trendData.forEach(t => lines.push(`${t.date};${t.registered};${t.cumulative}`));
    lines.push("");
    lines.push("Reminder-Wirksamkeit");
    lines.push("Kanal;Gesendet;Konvertiert;Rate");
    reminderData.forEach(r => lines.push(`${r.channel};${r.sent};${r.converted};${r.sent ? ((r.converted / r.sent) * 100).toFixed(1) : 0}%`));
    lines.push("");
    lines.push("Top 20 Nicht-Registrierte");
    lines.push("Kd-Nr.;Firma;E-Mail;Geräte;Letzte Erinnerung");
    topUnregistered.forEach(c => lines.push(
      `${c.customer_number || ""};${(c.company_name || c.contact_name || "").replace(/;/g, ",")};${c.email || ""};${c.device_count};${c.last_reminder_at ? new Date(c.last_reminder_at).toLocaleDateString("de-DE") : ""}`
    ));
    const csv = lines.join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alixsmart-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Bericht exportiert");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AlixSmart Analytics"
        subtitle="Registrierungs-Trends, Reminder-Wirksamkeit und Handlungsempfehlungen"
        actions={
          <div className="flex gap-2 items-center">
            <Select value={range} onValueChange={(v: any) => setRange(v)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Letzte 30 Tage</SelectItem>
                <SelectItem value="90">Letzte 90 Tage</SelectItem>
                <SelectItem value="180">Letzte 180 Tage</SelectItem>
                <SelectItem value="365">Letzte 12 Monate</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportReport}>
              <Download className="h-4 w-4 mr-2" /> Bericht (CSV)
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
            </Button>
          </div>
        }
      />

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="Registrierungsquote" value={`${kpis.total ? ((kpis.registered / kpis.total) * 100).toFixed(1) : 0}%`}
          sub={`${kpis.registered} / ${kpis.total}`} tone="emerald" icon={<Target className="h-4 w-4" />} />
        <KpiTile label="Nicht registriert" value={kpis.unregistered} sub="Potenzial" tone="rose" icon={<Users className="h-4 w-4" />} />
        <KpiTile label="Reminder gesendet" value={kpis.remindersSent} sub={`in ${range} Tagen`} tone="sky" icon={<Bell className="h-4 w-4" />} />
        <KpiTile label="Reminder-Konversion" value={`${kpis.conversion.toFixed(1)}%`} sub={`${kpis.convertedAfterReminder} konvertiert`} tone="amber" icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      {/* Trend */}
      <div className="rounded-lg border bg-card/50 p-4">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Registrierungs-Trend</div>
        <div className="h-[280px]">
          <ResponsiveContainer>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Line type="monotone" dataKey="registered" name="Neu registriert" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cumulative" name="Kumulativ" stroke="#38bdf8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Reminder Wirksamkeit */}
        <div className="rounded-lg border bg-card/50 p-4">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Reminder-Wirksamkeit</div>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <BarChart data={reminderData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Bar dataKey="sent" name="Gesendet" fill="#38bdf8" />
                <Bar dataKey="converted" name="Konvertiert" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Verteilung */}
        <div className="rounded-lg border bg-card/50 p-4">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Status-Verteilung</div>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.name}: ${e.value}`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Nicht-Registrierte */}
      <div className="rounded-lg border bg-card/50 p-4">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Top 20 Nicht-Registrierte (nach Geräteanzahl)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 px-3">Kd-Nr.</th>
                <th className="py-2 px-3">Firma</th>
                <th className="py-2 px-3">E-Mail</th>
                <th className="py-2 px-3 text-right">Geräte</th>
                <th className="py-2 px-3">Letzte Erinnerung</th>
              </tr>
            </thead>
            <tbody>
              {topUnregistered.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Alle Kunden mit Geräten sind registriert 🎉</td></tr>
              )}
              {topUnregistered.map(c => (
                <tr key={c.customer_id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2 px-3 font-mono text-xs">{c.customer_number || "—"}</td>
                  <td className="py-2 px-3 font-medium">{c.company_name || c.contact_name || "—"}</td>
                  <td className="py-2 px-3 text-muted-foreground">{c.email || "—"}</td>
                  <td className="py-2 px-3 text-right font-semibold">{c.device_count}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground">
                    {c.last_reminder_at ? new Date(c.last_reminder_at).toLocaleDateString("de-DE") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, sub, tone, icon }: { label: string; value: string | number; sub?: string; tone?: "emerald"|"rose"|"amber"|"sky"; icon?: React.ReactNode }) {
  const toneCls =
    tone === "emerald" ? "border-emerald-500/30 text-emerald-300" :
    tone === "rose" ? "border-rose-500/30 text-rose-300" :
    tone === "amber" ? "border-amber-500/30 text-amber-300" :
    tone === "sky" ? "border-sky-500/30 text-sky-300" :
    "border-border text-foreground";
  return (
    <div className={`rounded-lg border bg-card/50 p-4 ${toneCls}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">{icon}{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs opacity-70 mt-1">{sub}</div>}
    </div>
  );
}
