import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Download, Eye, Globe, Radio, TrendingUp, Users } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import GoalsPanel from "@/components/connect/GoalsPanel";
import AlertsPanel from "@/components/connect/AlertsPanel";
import FunnelsPanel from "@/components/connect/FunnelsPanel";
import HeatmapPanel from "@/components/connect/HeatmapPanel";
import SessionsPanel from "@/components/connect/SessionsPanel";
import ExperimentsPanel from "@/components/connect/ExperimentsPanel";
import SegmentsPanel from "@/components/connect/SegmentsPanel";
import LiveMapPanel from "@/components/connect/LiveMapPanel";

const COLORS = ["#D4AF37", "#8B5CF6", "#0EA5E9", "#22C55E", "#F97316", "#EC4899", "#64748B"];
const DIMS = [
  { key: "referrer", label: "Referrer" },
  { key: "utm_source", label: "UTM Source" },
  { key: "utm_medium", label: "UTM Medium" },
  { key: "utm_campaign", label: "UTM Campaign" },
  { key: "country", label: "Länder" },
  { key: "device", label: "Geräte" },
  { key: "browser", label: "Browser" },
  { key: "os", label: "OS" },
  { key: "language", label: "Sprache" },
] as const;

type Live = { online_now: number; today: number; yesterday: number; week: number; month: number; year: number; pageviews_today: number };

export default function WebsiteAnalytics() {
  const { id } = useParams<{ id: string }>();
  const [site, setSite] = useState<any | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [series, setSeries] = useState<{ day: string; views: number; uniques: number }[]>([]);
  const [pages, setPages] = useState<{ page_url: string; views: number; uniques: number }[]>([]);
  const [dim, setDim] = useState<(typeof DIMS)[number]["key"]>("referrer");
  const [breakdown, setBreakdown] = useState<{ label: string; views: number; uniques: number }[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [range, setRange] = useState<7 | 30 | 90>(30);

  const from = useMemo(() => new Date(Date.now() - range * 864e5), [range]);
  const to = useMemo(() => new Date(Date.now() + 864e5), [range]);

  async function loadAll() {
    if (!id) return;
    const [{ data: s }, { data: l }, { data: sr }, { data: pg }, { data: br }, { data: fd }] = await Promise.all([
      supabase.from("ac_websites").select("id, domain, project_name, api_key, cookieless_analytics, status").eq("id", id).maybeSingle(),
      supabase.rpc("ac_web_live", { _website_id: id }),
      supabase.rpc("ac_web_daily_series", { _website_id: id, _from: from.toISOString(), _to: to.toISOString() }),
      supabase.rpc("ac_web_top_pages", { _website_id: id, _from: from.toISOString(), _to: to.toISOString(), _limit: 15 }),
      supabase.rpc("ac_web_breakdown", { _website_id: id, _from: from.toISOString(), _to: to.toISOString(), _dim: dim }),
      supabase.from("ac_analytics_events")
        .select("event_type, page_url, referrer, country, device_type, browser, created_at")
        .eq("website_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setSite(s);
    setLive((l as any) ?? null);
    setSeries(((sr as any[]) ?? []).map((r) => ({ day: String(r.day).slice(5), views: Number(r.views), uniques: Number(r.uniques) })));
    setPages((pg as any[]) ?? []);
    setBreakdown((br as any[]) ?? []);
    setFeed((fd as any[]) ?? []);
  }

  useEffect(() => { loadAll(); }, [id, range, dim]);

  // Live-Feed via Realtime + Live-KPIs Refresh
  useEffect(() => {
    if (!id) return;
    const t = setInterval(() => {
      supabase.rpc("ac_web_live", { _website_id: id }).then(({ data }) => setLive((data as any) ?? null));
    }, 15000);
    const ch = supabase
      .channel(`ac_events_${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ac_analytics_events", filter: `website_id=eq.${id}` }, (payload) => {
        setFeed((cur) => [payload.new as any, ...cur].slice(0, 20));
      })
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(ch); };
  }, [id]);

  function copySnippet() {
    if (!site?.api_key) return;
    const s = `<script async src="${window.location.origin}/connect.js" data-key="${site.api_key}"></script>`;
    navigator.clipboard.writeText(s);
    toast.success("Snippet kopiert");
  }

  function csv() {
    const rows = [["day", "views", "uniques"], ...series.map((r) => [r.day, r.views, r.uniques])];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${site?.domain || "site"}-analytics.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const donut = breakdown.slice(0, 7).map((r, i) => ({ name: r.label || "(leer)", value: r.views, fill: COLORS[i % COLORS.length] }));

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/connect/websites"><Button size="sm" variant="ghost"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="h-5 w-5" /> {site?.project_name || "…"}
              {site?.cookieless_analytics ? <Badge variant="outline" className="text-[10px]">Cookieless</Badge> : <Badge variant="secondary" className="text-[10px]">Consent-Cookie</Badge>}
            </h2>
            <p className="text-xs text-muted-foreground font-mono">{site?.domain}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((n) => (
            <Button key={n} size="sm" variant={range === n ? "default" : "outline"} onClick={() => setRange(n as any)}>{n}d</Button>
          ))}
          <Button size="sm" variant="outline" onClick={copySnippet}><Copy className="h-4 w-4 mr-1" /> Snippet</Button>
          <Button size="sm" variant="outline" onClick={csv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Kpi label="Online jetzt" value={live?.online_now ?? 0} icon={Radio} accent />
        <Kpi label="Heute" value={live?.today ?? 0} icon={Users} />
        <Kpi label="Gestern" value={live?.yesterday ?? 0} icon={Users} />
        <Kpi label="Woche" value={live?.week ?? 0} icon={TrendingUp} />
        <Kpi label="Monat" value={live?.month ?? 0} icon={TrendingUp} />
        <Kpi label="Jahr" value={live?.year ?? 0} icon={TrendingUp} />
        <Kpi label="Seitenaufrufe heute" value={live?.pageviews_today ?? 0} icon={Eye} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Besucher & Aufrufe · {range} Tage</CardTitle></CardHeader>
        <CardContent style={{ height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Line type="monotone" dataKey="views" stroke="#D4AF37" strokeWidth={2} dot={false} name="Views" />
              <Line type="monotone" dataKey="uniques" stroke="#8B5CF6" strokeWidth={2} dot={false} name="Unique" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top Seiten</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>URL</TableHead><TableHead className="text-right">Views</TableHead><TableHead className="text-right">Unique</TableHead></TableRow></TableHeader>
              <TableBody>
                {pages.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs truncate max-w-[380px]" title={r.page_url}>{shortenUrl(r.page_url)}</TableCell>
                    <TableCell className="text-right">{r.views}</TableCell>
                    <TableCell className="text-right">{r.uniques}</TableCell>
                  </TableRow>
                ))}
                {pages.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-sm">Keine Daten</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Aufschlüsselung</CardTitle>
            <Tabs value={dim} onValueChange={(v) => setDim(v as any)}>
              <TabsList className="h-7">
                {DIMS.slice(0, 5).map((d) => <TabsTrigger key={d.key} value={d.key} className="text-[10px] px-2 h-6">{d.label}</TabsTrigger>)}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent style={{ height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" innerRadius={45} outerRadius={90} paddingAngle={2}>
                  {donut.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-1">
              {DIMS.slice(5).map((d) => (
                <Button key={d.key} size="sm" variant={dim === d.key ? "default" : "outline"} className="h-6 text-[10px]" onClick={() => setDim(d.key)}>{d.label}</Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Live-Feed (letzte 20 Ereignisse)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Zeit</TableHead><TableHead>Typ</TableHead><TableHead>Seite</TableHead><TableHead>Referrer</TableHead><TableHead>Land</TableHead><TableHead>Gerät</TableHead></TableRow></TableHeader>
            <TableBody>
              {feed.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleTimeString("de-DE")}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.event_type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs truncate max-w-[280px]" title={r.page_url}>{shortenUrl(r.page_url)}</TableCell>
                  <TableCell className="text-xs truncate max-w-[180px]">{shortenUrl(r.referrer) || "(direct)"}</TableCell>
                  <TableCell className="text-xs">{r.country || "–"}</TableCell>
                  <TableCell className="text-xs">{r.device_type || "–"}</TableCell>
                </TableRow>
              ))}
              {feed.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">Warte auf Events…</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {id && <LiveMapPanel websiteId={id} />}
      {id && <GoalsPanel websiteId={id} from={from} to={to} />}
      {id && <FunnelsPanel websiteId={id} from={from} to={to} />}
      {id && <ExperimentsPanel websiteId={id} from={from} to={to} />}
      {id && <SegmentsPanel websiteId={id} from={from} to={to} />}
      {id && <SessionsPanel websiteId={id} from={from} to={to} />}
      {id && <HeatmapPanel websiteId={id} from={from} to={to} />}
      {id && <AlertsPanel websiteId={id} />}
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent }: { label: string; value: number | string; icon: any; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/60" : undefined}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
          <Icon className={`h-3.5 w-3.5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div className={`mt-1 text-2xl font-semibold ${accent ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function shortenUrl(u?: string | null): string {
  if (!u) return "";
  try { const url = new URL(u); return url.pathname + (url.search || ""); } catch { return u; }
}
