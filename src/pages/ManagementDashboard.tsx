import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Activity, AlertTriangle, BarChart3, Boxes, CalendarClock, CheckCircle2, ClipboardList,
  Download, FileSpreadsheet, FileText, Loader2, Package, ShieldCheck, Ticket, TrendingUp,
  Truck, Users, Wrench, Cog, Building2,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type KPI = { label: string; value: string | number; hint?: string; icon?: any; tone?: "default" | "warn" | "ok" | "danger" };

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfYear(d = new Date()) { return new Date(d.getFullYear(), 0, 1); }
function fmtEUR(n: number) { return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0); }
function fmtNum(n: number) { return new Intl.NumberFormat("de-DE").format(n || 0); }

async function count(table: string, filter?: (q: any) => any) {
  let q: any = supabase.from(table as any).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: c, error } = await q;
  if (error) return 0;
  return c ?? 0;
}

export default function ManagementDashboard() {
  const { hasAnyRole, isAdmin } = useAuth();
  const showFinance = isAdmin || hasAnyRole(["Geschäftsführung", "Finance"]);
  const showService = isAdmin || hasAnyRole(["Geschäftsführung", "Serviceleitung", "Service", "Technik"]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, any>>({});
  const [trendOrders, setTrendOrders] = useState<{ month: string; orders: number; revenue: number }[]>([]);
  const [trendTickets, setTrendTickets] = useState<{ month: string; count: number }[]>([]);

  async function loadAll() {
    setLoading(true);
    const now = new Date();
    const todayISO = startOfDay(now).toISOString();
    const monthISO = startOfMonth(now).toISOString();
    const yearISO = startOfYear(now).toISOString();
    const lastYear = new Date(now.getFullYear() - 1, 0, 1).toISOString();

    try {
      // Vertrieb
      const [ordersToday, ordersMonth, openQuotes] = await Promise.all([
        count("orders", q => q.gte("created_at", todayISO)),
        count("orders", q => q.gte("created_at", monthISO)),
        count("quotes", q => q.eq("status", "open").or("status.eq.draft,status.eq.sent")),
      ]);
      // Revenue month/year via invoices total
      const [invMonth, invYear] = await Promise.all([
        supabase.from("invoices" as any).select("total").gte("created_at", monthISO),
        supabase.from("invoices" as any).select("total").gte("created_at", yearISO),
      ]);
      const revMonth = (invMonth.data ?? []).reduce((s: number, r: any) => s + Number(r.total || 0), 0);
      const revYear = (invYear.data ?? []).reduce((s: number, r: any) => s + Number(r.total || 0), 0);

      // Service / Tickets
      const [openTickets, inProgTickets, ticketsAll] = await Promise.all([
        count("tickets", q => q.in("status", ["Neu", "Offen", "open", "new"])),
        count("tickets", q => q.in("status", ["In Bearbeitung", "in_progress", "in progress", "Bearbeitung"])),
        supabase.from("tickets" as any).select("created_at,closed_at,status").gte("created_at", lastYear),
      ]);
      const tArr = (ticketsAll.data ?? []) as any[];
      const closed = tArr.filter(t => t.closed_at);
      const avgHours = closed.length
        ? closed.reduce((s, t) => s + (new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 3600000, 0) / closed.length
        : 0;
      const slaTarget = 48;
      const slaHit = closed.filter(t => (new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 3600000 <= slaTarget).length;
      const slaRate = closed.length ? (slaHit / closed.length) * 100 : 0;

      const ticketTrend = buildMonthlyTrend(tArr.map(t => t.created_at));

      // Reparatur
      const [repInShop, openQuotesRep, repApproval] = await Promise.all([
        count("repair_orders", q => q.in("repair_status", ["Werkstatt", "In Werkstatt", "In Reparatur"])),
        count("repair_quotes", q => q.in("status", ["draft", "sent", "open"])),
        count("repair_quotes", q => q.in("status", ["sent", "awaiting_decision"])),
      ]);

      // Wartung
      const today = startOfDay(now).toISOString().slice(0, 10);
      const next30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
      const [dueMaint, overdueMaint, maintMonth] = await Promise.all([
        count("device_maintenance", q => q.gte("next_maintenance_date", today).lte("next_maintenance_date", next30)),
        count("device_maintenance", q => q.lt("next_maintenance_date", today).neq("maintenance_status", "Abgeschlossen")),
        count("device_maintenance", q => q.gte("last_maintenance_date", monthISO.slice(0, 10))),
      ]);

      // Garantie & Kulanz
      const [warrActive, warrCases, goodwill, loaners] = await Promise.all([
        count("warranty_records", q => q.eq("warranty_status", "Aktiv")),
        count("warranty_decisions", q => q.in("decision", ["Genehmigt", "Approved", "approved"])),
        count("goodwill_cases"),
        count("loaner_device_assignments", q => q.is("returned_at", null)),
      ]);

      // Tourenplanung
      const [routesToday, routesOpen] = await Promise.all([
        count("route_plans", q => q.gte("plan_date", today).lte("plan_date", today)),
        count("route_plans", q => q.not("planning_status", "in", "(erledigt,abgesagt,storniert)")),
      ]);

      // Lager / Ersatzteile
      const [criticalStock, openPartOrders, goodsReceipts] = await Promise.all([
        supabase.from("zoho_items" as any).select("id,stock_on_hand,reorder_level,min_stock").eq("is_spare_part", true),
        count("spare_part_orders", q => q.in("status", ["offen", "open", "ordered", "bestellt"])),
        count("goods_receipts", q => q.gte("received_at", monthISO)),
      ]);
      const critical = (criticalStock.data ?? []).filter((r: any) =>
        Number(r.stock_on_hand || 0) <= Math.max(Number(r.reorder_level || 0), Number(r.min_stock || 0))
      ).length;

      // Kundenportal
      const [portalUsers, portalActive] = await Promise.all([
        count("customer_portal_users"),
        count("customer_portal_users", q => q.eq("status", "active")),
      ]);

      // Gerätebestand
      const [activeDevices, riskDevices, warrantyDevices] = await Promise.all([
        count("device_health_scores"),
        count("device_health_scores", q => q.eq("health_status", "rot")),
        count("warranty_records", q => q.eq("warranty_status", "Aktiv")),
      ]);

      // Orders trend (last 12 months)
      const since12 = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();
      const ordersTrendRaw = await supabase.from("orders" as any).select("created_at,total_amount").gte("created_at", since12);
      const oArr = (ordersTrendRaw.data ?? []) as any[];
      const monthly = new Map<string, { orders: number; revenue: number }>();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const k = d.toISOString().slice(0, 7);
        monthly.set(k, { orders: 0, revenue: 0 });
      }
      for (const r of oArr) {
        const k = (r.created_at as string).slice(0, 7);
        const v = monthly.get(k); if (!v) continue;
        v.orders += 1;
        v.revenue += Number(r.total_amount || 0);
      }
      const trend = Array.from(monthly.entries()).map(([month, v]) => ({ month: month.slice(5), ...v }));

      setData({
        ordersToday, ordersMonth, revMonth, revYear, openQuotes,
        openTickets, inProgTickets, avgHours, slaRate,
        repInShop, openQuotesRep, repApproval,
        dueMaint, overdueMaint, maintMonth,
        warrActive, warrCases, goodwill, loaners,
        routesToday, routesOpen,
        critical, openPartOrders, goodsReceipts,
        portalUsers, portalActive,
        activeDevices, riskDevices, warrantyDevices,
      });
      setTrendOrders(trend);
      setTrendTickets(ticketTrend);
    } catch (e: any) {
      console.error(e);
      toast.error("Fehler beim Laden der Kennzahlen");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const kpis: { group: string; items: KPI[] }[] = useMemo(() => [
    {
      group: "Vertrieb",
      items: [
        { label: "Aufträge heute", value: fmtNum(data.ordersToday ?? 0), icon: ClipboardList },
        { label: "Aufträge Monat", value: fmtNum(data.ordersMonth ?? 0), icon: TrendingUp },
        { label: "Umsatz Monat", value: fmtEUR(data.revMonth ?? 0), icon: BarChart3 },
        { label: "Umsatz Jahr", value: fmtEUR(data.revYear ?? 0), icon: BarChart3 },
        { label: "Angebote offen", value: fmtNum(data.openQuotes ?? 0), icon: FileText },
      ],
    },
    {
      group: "Service",
      items: [
        { label: "Offene Tickets", value: fmtNum(data.openTickets ?? 0), icon: Ticket },
        { label: "In Bearbeitung", value: fmtNum(data.inProgTickets ?? 0), icon: Activity },
        { label: "Ø Bearbeitungszeit", value: `${(data.avgHours ?? 0).toFixed(1)} h`, icon: CalendarClock },
        { label: "SLA-Erfüllung", value: `${(data.slaRate ?? 0).toFixed(0)} %`, icon: CheckCircle2, tone: (data.slaRate ?? 0) >= 80 ? "ok" : "warn" },
      ],
    },
    {
      group: "Reparatur",
      items: [
        { label: "Geräte in Werkstatt", value: fmtNum(data.repInShop ?? 0), icon: Wrench },
        { label: "Offene KVs", value: fmtNum(data.openQuotesRep ?? 0), icon: FileText },
        { label: "Freigaben ausstehend", value: fmtNum(data.repApproval ?? 0), icon: AlertTriangle },
      ],
    },
    {
      group: "Wartung",
      items: [
        { label: "Fällige Wartungen (30 T.)", value: fmtNum(data.dueMaint ?? 0), icon: Cog },
        { label: "Überfällige Wartungen", value: fmtNum(data.overdueMaint ?? 0), icon: AlertTriangle, tone: (data.overdueMaint ?? 0) > 0 ? "danger" : "ok" },
        { label: "Wartungen Monat", value: fmtNum(data.maintMonth ?? 0), icon: CheckCircle2 },
      ],
    },
    {
      group: "Garantie & Kulanz",
      items: [
        { label: "Aktive Garantien", value: fmtNum(data.warrActive ?? 0), icon: ShieldCheck },
        { label: "Garantiefälle", value: fmtNum(data.warrCases ?? 0), icon: ShieldCheck },
        { label: "Kulanzfälle", value: fmtNum(data.goodwill ?? 0), icon: ShieldCheck },
        { label: "Ersatzgeräte im Umlauf", value: fmtNum(data.loaners ?? 0), icon: Package },
      ],
    },
    {
      group: "Tourenplanung",
      items: [
        { label: "Einsätze heute", value: fmtNum(data.routesToday ?? 0), icon: Truck },
        { label: "Offene Einsätze", value: fmtNum(data.routesOpen ?? 0), icon: Truck },
      ],
    },
    {
      group: "Lager",
      items: [
        { label: "Kritische Bestände", value: fmtNum(data.critical ?? 0), icon: AlertTriangle, tone: (data.critical ?? 0) > 0 ? "warn" : "ok" },
        { label: "Offene Bestellungen", value: fmtNum(data.openPartOrders ?? 0), icon: Boxes },
        { label: "Wareneingänge (Monat)", value: fmtNum(data.goodsReceipts ?? 0), icon: Package },
      ],
    },
    {
      group: "Kundenportal",
      items: [
        { label: "Registrierte Kunden", value: fmtNum(data.portalUsers ?? 0), icon: Users },
        { label: "Aktive Kunden", value: fmtNum(data.portalActive ?? 0), icon: Users },
      ],
    },
    {
      group: "Gerätebestand",
      items: [
        { label: "Aktive Geräte", value: fmtNum(data.activeDevices ?? 0), icon: Building2 },
        { label: "Geräte in Garantie", value: fmtNum(data.warrantyDevices ?? 0), icon: ShieldCheck },
        { label: "Hohes Risiko (rot)", value: fmtNum(data.riskDevices ?? 0), icon: AlertTriangle, tone: (data.riskDevices ?? 0) > 0 ? "danger" : "ok" },
      ],
    },
  ], [data]);

  function exportCSV() {
    const rows: string[] = ["Bereich;Kennzahl;Wert"];
    for (const g of kpis) for (const k of g.items) rows.push(`${g.group};${k.label};${k.value}`);
    download("management-kpis.csv", rows.join("\n"), "text/csv;charset=utf-8");
  }
  function exportJSON() {
    download("management-kpis.json", JSON.stringify({ generatedAt: new Date().toISOString(), data, kpis }, null, 2), "application/json");
  }
  function exportPDF() {
    window.print();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Management Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">Echtzeit-Auswertung aller Unternehmensbereiche</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><FileSpreadsheet className="mr-1" />CSV</Button>
          <Button variant="outline" size="sm" onClick={exportJSON}><Download className="mr-1" />JSON</Button>
          <Button variant="outline" size="sm" onClick={exportPDF}><FileText className="mr-1" />PDF</Button>
          <Button size="sm" onClick={loadAll} disabled={loading}>
            {loading ? <Loader2 className="mr-1 animate-spin" /> : <Activity className="mr-1" />}
            Aktualisieren
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="print:hidden">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="details">Detail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          {kpis.map(group => {
            if (group.group === "Garantie & Kulanz" && !showService && !showFinance) return null;
            return (
              <div key={group.group}>
                <h2 className="text-lg font-semibold mb-2">{group.group}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {group.items.map(k => {
                    const Icon = k.icon ?? Activity;
                    const tone = k.tone === "danger" ? "border-destructive/40 bg-destructive/5"
                      : k.tone === "warn" ? "border-yellow-500/40 bg-yellow-500/5"
                      : k.tone === "ok" ? "border-emerald-500/40 bg-emerald-500/5"
                      : "";
                    return (
                      <Card key={k.label} className={tone}>
                        <CardHeader className="pb-2">
                          <CardDescription className="flex items-center gap-2"><Icon className="h-4 w-4" /> {k.label}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{loading ? "–" : k.value}</div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="trends" className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aufträge & Umsatz (12 Monate)</CardTitle>
            </CardHeader>
            <CardContent style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendOrders}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="l" />
                  <YAxis yAxisId="r" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="l" dataKey="orders" name="Aufträge" fill="hsl(var(--primary))" />
                  <Bar yAxisId="r" dataKey="revenue" name="Umsatz" fill="hsl(var(--accent))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ticketvolumen (12 Monate)</CardTitle>
            </CardHeader>
            <CardContent style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendTickets}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Tickets" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Vergleich</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Aufträge Monat" value={fmtNum(data.ordersMonth ?? 0)} />
                <Stat label="Umsatz Monat" value={fmtEUR(data.revMonth ?? 0)} />
                <Stat label="Umsatz Jahr" value={fmtEUR(data.revYear ?? 0)} />
                <Stat label="Ø Auftrag Monat" value={fmtEUR((data.revMonth ?? 0) / Math.max(1, data.ordersMonth ?? 0))} />
              </div>
              <div className="mt-4">
                <Badge variant="secondary">Hinweis: Werte basieren ausschließlich auf bestehenden Datenquellen.</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function buildMonthlyTrend(dates: string[]) {
  const now = new Date();
  const m = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    m.set(d.toISOString().slice(0, 7), 0);
  }
  for (const ds of dates) {
    const k = (ds ?? "").slice(0, 7);
    if (m.has(k)) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries()).map(([k, count]) => ({ month: k.slice(5), count }));
}

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
