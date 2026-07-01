import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, AlertTriangle, BarChart3, Crown, Flame, Gauge, Loader2,
  Sparkles, TrendingUp, Users, Zap,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { useRevenueMask } from "@/lib/revenue-mask";

const fmtNum = (n: number) => new Intl.NumberFormat("de-DE").format(n || 0);
const pct = (n: number) => `${(n || 0).toFixed(0)} %`;

function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfYear(d = new Date()) { return new Date(d.getFullYear(), 0, 1); }

type Top = { name: string; revenue: number; count: number };

export default function ExecutiveCommandCenter() {
  const { fmtEUR } = useRevenueMask();
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<Date>(new Date());
  const [kpis, setKpis] = useState<any>({});
  const [trend, setTrend] = useState<{ month: string; revenue: number; orders: number }[]>([]);
  const [top, setTop] = useState<Top[]>([]);
  const [heatmap, setHeatmap] = useState<{ key: string; value: number; intensity: number }[]>([]);

  // Live-Uhr für das Hero
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const today = new Date();
      const monthISO = startOfMonth(today).toISOString();
      const yearISO = startOfYear(today).toISOString();
      const since12 = new Date(today.getFullYear(), today.getMonth() - 11, 1).toISOString();
      const since90 = new Date(today.getTime() - 90 * 86400_000).toISOString();
      const lastYear = new Date(today.getFullYear() - 1, 0, 1).toISOString();

      const [invMonthR, invYearR, ordersMonthR, ordersTrendR, ticketsR, devicesR, customersR, top90R] = await Promise.all([
        supabase.from("invoices" as any).select("total").gte("created_at", monthISO),
        supabase.from("invoices" as any).select("total").gte("created_at", yearISO),
        supabase.from("orders" as any).select("id", { count: "exact", head: true }).gte("created_at", monthISO),
        supabase.from("orders" as any).select("created_at,total_amount").gte("created_at", since12),
        supabase.from("tickets" as any).select("created_at,closed_at,status").gte("created_at", lastYear),
        supabase.from("device_health_scores" as any).select("health_status"),
        supabase.from("customers" as any).select("id", { count: "exact", head: true }),
        supabase.from("orders" as any).select("customer_name,total_amount").gte("created_at", since90),
      ]);

      const revMonth = (invMonthR.data ?? []).reduce((s: number, r: any) => s + Number(r.total || 0), 0);
      const revYear = (invYearR.data ?? []).reduce((s: number, r: any) => s + Number(r.total || 0), 0);
      const ordersMonth = ordersMonthR.count ?? 0;
      const customers = customersR.count ?? 0;

      // Ticket-Velocity / SLA
      const tArr = (ticketsR.data ?? []) as any[];
      const openTickets = tArr.filter(t => !t.closed_at).length;
      const closed = tArr.filter(t => t.closed_at);
      const avgH = closed.length
        ? closed.reduce((s, t) => s + (new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 3_600_000, 0) / closed.length
        : 0;
      const slaTarget = 48;
      const slaRate = closed.length
        ? (closed.filter(t => (new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 3_600_000 <= slaTarget).length / closed.length) * 100
        : 100;

      // Geräte-Risiko
      const dArr = (devicesR.data ?? []) as any[];
      const atRisk = dArr.filter(d => d.health_status === "rot").length;
      const totalDev = dArr.length;

      // 12-Monats-Trend & Forecast
      const oArr = (ordersTrendR.data ?? []) as any[];
      const monthly = new Map<string, { revenue: number; orders: number }>();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        monthly.set(d.toISOString().slice(0, 7), { revenue: 0, orders: 0 });
      }
      for (const r of oArr) {
        const k = (r.created_at as string).slice(0, 7);
        const v = monthly.get(k); if (!v) continue;
        v.revenue += Number(r.total_amount || 0);
        v.orders += 1;
      }
      const trendArr = Array.from(monthly.entries()).map(([month, v]) => ({
        month: month.slice(5),
        revenue: Math.round(v.revenue),
        orders: v.orders,
      }));

      // Heatmap: letzte 12 Monate, Intensität = Umsatz relativ zum Max
      const max = Math.max(1, ...trendArr.map(t => t.revenue));
      const hm = trendArr.map(t => ({
        key: t.month,
        value: t.revenue,
        intensity: Math.min(1, t.revenue / max),
      }));

      // AI-Forecast: einfache lineare Projektion aus letzten 6 Monaten
      const last6 = trendArr.slice(-6).map(t => t.revenue);
      const avg6 = last6.reduce((s, v) => s + v, 0) / Math.max(1, last6.length);
      const slope = last6.length >= 2 ? (last6[last6.length - 1] - last6[0]) / (last6.length - 1) : 0;
      const forecast = Math.max(0, Math.round(avg6 + slope * 1.5));

      // Top 5 Kunden 90T
      const t90 = (top90R.data ?? []) as any[];
      const grouped = new Map<string, Top>();
      for (const o of t90) {
        const name = o.customer_name || "—";
        const e = grouped.get(name) || { name, revenue: 0, count: 0 };
        e.revenue += Number(o.total_amount || 0);
        e.count += 1;
        grouped.set(name, e);
      }
      const topArr = Array.from(grouped.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setKpis({
        revMonth, revYear, ordersMonth, customers,
        openTickets, avgH, slaRate, atRisk, totalDev,
        forecast,
      });
      setTrend(trendArr);
      setHeatmap(hm);
      setTop(topArr);
    } catch (e: any) {
      console.error(e);
      toast.error("Fehler beim Laden der Executive-Kennzahlen");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const heroTiles = useMemo(() => ([
    { label: "Umsatz MTD", value: fmtEUR(kpis.revMonth ?? 0), icon: BarChart3, accent: "from-amber-500/30 to-amber-500/0" },
    { label: "Umsatz YTD", value: fmtEUR(kpis.revYear ?? 0), icon: TrendingUp, accent: "from-emerald-500/30 to-emerald-500/0" },
    { label: "Aufträge MTD", value: fmtNum(kpis.ordersMonth ?? 0), icon: Zap, accent: "from-sky-500/30 to-sky-500/0" },
    { label: "Kunden", value: fmtNum(kpis.customers ?? 0), icon: Users, accent: "from-violet-500/30 to-violet-500/0" },
    { label: "SLA", value: pct(kpis.slaRate ?? 0), icon: Gauge,
      accent: (kpis.slaRate ?? 0) >= 80 ? "from-emerald-500/30 to-emerald-500/0" : "from-rose-500/30 to-rose-500/0" },
    { label: "Geräte at Risk", value: `${fmtNum(kpis.atRisk ?? 0)} / ${fmtNum(kpis.totalDev ?? 0)}`, icon: AlertTriangle,
      accent: (kpis.atRisk ?? 0) > 0 ? "from-rose-500/30 to-rose-500/0" : "from-emerald-500/30 to-emerald-500/0" },
  ]), [kpis]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 p-6 md:p-8"
        style={{
          background:
            "radial-gradient(60% 80% at 0% 0%, hsl(200 90% 50% / 0.18), transparent 70%)," +
            "radial-gradient(60% 80% at 100% 100%, hsl(38 90% 55% / 0.18), transparent 70%)," +
            "linear-gradient(180deg, hsl(230 30% 6%) 0%, hsl(225 35% 4%) 100%)",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-amber-300/80">
              <Crown className="h-3.5 w-3.5" /> Executive Command Center
              <Badge variant="outline" className="border-amber-400/30 text-amber-200/90">Phase I-7</Badge>
            </div>
            <h1 className="mt-2 text-3xl md:text-4xl font-bold sig-mark">State of the Business</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {now.toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              {" · "}
              {now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-amber-400/20 bg-black/40 px-4 py-3 backdrop-blur">
              <div className="text-[10px] uppercase tracking-widest text-amber-300/70 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> AI-Forecast nächster Monat
              </div>
              <div className="text-xl font-semibold sig-mark">{fmtEUR(kpis.forecast ?? 0)}</div>
            </div>
          </div>
        </div>

        {/* Hero Tiles */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {heroTiles.map((t) => (
            <div key={t.label}
              className={`relative overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur p-3`}>
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${t.accent} opacity-60`} />
              <div className="relative">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t.label}</span>
                  <t.icon className="h-3.5 w-3.5" />
                </div>
                <div className="mt-1 text-lg font-semibold">{loading ? <Skeleton className="h-5 w-20" /> : t.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-400" /> Umsatz-Puls (12 Monate)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {loading ? <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(38 90% 60%)" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="hsl(38 90% 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
                  <XAxis dataKey="month" stroke="hsl(0 0% 100% / 0.4)" fontSize={11} />
                  <YAxis stroke="hsl(0 0% 100% / 0.4)" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    contentStyle={{ background: "#0a0a0a", border: "1px solid hsl(38 90% 60% / 0.3)", borderRadius: 12 }}
                    formatter={(v: any) => fmtEUR(Number(v))}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(38 90% 60%)" strokeWidth={2} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-rose-400" /> Umsatz-Heatmap (12M)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {heatmap.map((c) => (
                  <div key={c.key} className="relative h-12 rounded-md border border-white/10 overflow-hidden" title={`${c.key}: ${fmtEUR(c.value)}`}>
                    <div className="absolute inset-0"
                      style={{ background: `hsl(38 90% 55% / ${0.10 + c.intensity * 0.75})` }} />
                    <div className="relative h-full flex flex-col items-center justify-center text-[10px]">
                      <span className="text-white/80">{c.key}</span>
                      <span className="font-semibold">{Math.round(c.value / 1000)}k</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top + Pulse row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" /> Top 5 Kunden (90 Tage)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : top.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Keine Daten in den letzten 90 Tagen.</div>
            ) : (
              <div className="space-y-2">
                {top.map((c, i) => {
                  const max = top[0].revenue || 1;
                  const w = (c.revenue / max) * 100;
                  return (
                    <div key={c.name} className="relative rounded-lg border border-white/10 bg-black/30 p-3 overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500/20 to-transparent"
                        style={{ width: `${w}%` }} />
                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs w-5 text-amber-300/80">#{i + 1}</span>
                          <span className="font-medium truncate max-w-[18rem]">{c.name}</span>
                          <Badge variant="outline" className="text-[10px]">{c.count} Aufträge</Badge>
                        </div>
                        <span className="font-semibold sig-mark">{fmtEUR(c.revenue)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-sky-400" /> Service-Puls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PulseRow label="Offene Tickets" value={fmtNum(kpis.openTickets ?? 0)} tone="warn" />
            <PulseRow label="Ø Bearbeitungszeit" value={`${(kpis.avgH ?? 0).toFixed(1)} h`} tone="default" />
            <PulseRow label="SLA-Erfüllung" value={pct(kpis.slaRate ?? 0)} tone={(kpis.slaRate ?? 0) >= 80 ? "ok" : "danger"} />
            <PulseRow label="Geräte at Risk" value={fmtNum(kpis.atRisk ?? 0)} tone={(kpis.atRisk ?? 0) > 0 ? "danger" : "ok"} />
            <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-500/5 p-3">
              <div className="text-[10px] uppercase tracking-widest text-amber-300/80 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> AI-Hinweis
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Forecast basiert auf linearer Trendprojektion der letzten 6 Monate. Erweiterte Modelle folgen in späteren Phasen.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PulseRow({ label, value, tone }: { label: string; value: string; tone: "default" | "ok" | "warn" | "danger" }) {
  const color =
    tone === "ok" ? "text-emerald-400" :
    tone === "warn" ? "text-amber-300" :
    tone === "danger" ? "text-rose-400" : "text-foreground";
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-base font-semibold ${color}`}>{value}</span>
    </div>
  );
}
