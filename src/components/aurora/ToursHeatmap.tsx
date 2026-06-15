import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck } from "lucide-react";

/**
 * Aurora 2.0 — Tours Heatmap
 * Zeigt geplante Touren der letzten 52 Wochen aus `route_plans`.
 */
export function ToursHeatmap() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const since = new Date();
      since.setDate(since.getDate() - 365);
      const { data } = await supabase
        .from("route_plans")
        .select("plan_date")
        .gte("plan_date", since.toISOString().slice(0, 10))
        .limit(5000);
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as { plan_date: string }[]) {
        if (!row.plan_date) continue;
        const d = row.plan_date.slice(0, 10);
        map[d] = (map[d] ?? 0) + 1;
      }
      setCounts(map);
      setLoading(false);
    };
    load();
  }, []);

  const { weeks, max } = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    const dow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dow);
    const all: { date: string; count: number }[] = [];
    let max = 0;
    for (let i = 0; i < 53 * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const c = counts[iso] ?? 0;
      if (c > max) max = c;
      all.push({ date: iso, count: c });
    }
    const weeks: { date: string; count: number }[][] = [];
    for (let w = 0; w < 53; w++) weeks.push(all.slice(w * 7, w * 7 + 7));
    return { weeks, max: Math.max(1, max) };
  }, [counts]);

  const alpha = (c: number) => (c === 0 ? 0.06 : 0.18 + (c / max) * 0.72);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-4 w-4 text-primary" />
          Tourenplan-Auslastung · 52 Wochen
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {loading ? "lädt…" : `max ${max}/Tag`}
        </span>
      </CardHeader>
      <CardContent>
        <div className="a2-heatmap-grid overflow-x-auto">
          <div />
          {weeks.map((week, wi) => (
            <div className="a2-heatmap-week" key={wi}>
              {week.map((day) => (
                <div
                  key={day.date}
                  className="a2-heatmap-day"
                  style={{ ["--a2-cell-alpha" as any]: alpha(day.count) }}
                  title={`${day.date}: ${day.count} Touren`}
                />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default ToursHeatmap;
