import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Eye, Users, TrendingUp } from "lucide-react";

type Kpi = { visitors_today: number; pageviews_today: number; live: number; total_7d: number };

export default function AnalyticsOverview() {
  const [kpi, setKpi] = useState<Kpi>({ visitors_today: 0, pageviews_today: 0, live: 0, total_7d: 0 });

  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0,0,0,0);
      const iso = today.toISOString();
      const iso7 = new Date(Date.now() - 7 * 864e5).toISOString();
      const live = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const [{ count: pv }, { data: uniq }, { count: liveC }, { data: uniq7 }] = await Promise.all([
        supabase.from("ac_analytics_events").select("id", { count: "exact", head: true }).gte("created_at", iso).eq("event_type", "pageview"),
        supabase.from("ac_analytics_events").select("visitor_hash").gte("created_at", iso).eq("event_type", "pageview"),
        supabase.from("ac_analytics_events").select("id", { count: "exact", head: true }).gte("created_at", live).eq("event_type", "heartbeat"),
        supabase.from("ac_analytics_events").select("visitor_hash").gte("created_at", iso7).eq("event_type", "pageview"),
      ]);

      const unique = new Set((uniq || []).map((r: any) => r.visitor_hash).filter(Boolean));
      const unique7 = new Set((uniq7 || []).map((r: any) => r.visitor_hash).filter(Boolean));
      setKpi({ visitors_today: unique.size, pageviews_today: pv || 0, live: liveC || 0, total_7d: unique7.size });
    })();
  }, []);

  const items = [
    { label: "Live Besucher (5 Min.)", value: kpi.live, icon: TrendingUp },
    { label: "Besucher heute", value: kpi.visitors_today, icon: Users },
    { label: "Seitenaufrufe heute", value: kpi.pageviews_today, icon: Eye },
    { label: "Besucher (7 Tage)", value: kpi.total_7d, icon: BarChart3 },
  ];

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      <div>
        <h2 className="text-lg font-semibold">Website Analytics</h2>
        <p className="text-sm text-muted-foreground">Cookieless Tracking über alle verbundenen Domains. Detailansichten folgen in Phase 4.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {items.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <k.icon className="h-3.5 w-3.5" />{k.label}
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-semibold">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Hinweis</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Sobald das Widget-Skript in Phase 2 (Website Chat &amp; Tracker) live geht, füllen sich diese KPIs automatisch. Die Datenbank
          (Tabelle <code>ac_analytics_events</code>) ist bereits vorbereitet — cookieless mit IP-Anonymisierung.
        </CardContent>
      </Card>
    </div>
  );
}
