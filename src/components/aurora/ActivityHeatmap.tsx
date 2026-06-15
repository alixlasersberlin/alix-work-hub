import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

/**
 * Aurora 2.0 — Activity Heatmap
 * Zeigt Ticket-Aktivität der letzten 52 Wochen (GitHub-Style).
 * Liest Daten read-only aus `tickets` (RLS-respektiert).
 */
export function ActivityHeatmap() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const since = new Date();
      since.setDate(since.getDate() - 365);
      const { data, error } = await supabase
        .from("tickets")
        .select("created_at")
        .gte("created_at", since.toISOString())
        .limit(5000);
      if (!error && data) {
        const map: Record<string, number> = {};
        for (const row of data as { created_at: string }[]) {
          const d = row.created_at.slice(0, 10);
          map[d] = (map[d] ?? 0) + 1;
        }
        setCounts(map);
      }
      setLoading(false);
    };
    load();
  }, []);

  const { weeks, max } = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    // align to Monday
    const dow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dow);

    const allDays: { date: string; count: number }[] = [];
    let max = 0;
    for (let i = 0; i < 53 * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const c = counts[iso] ?? 0;
      if (c > max) max = c;
      allDays.push({ date: iso, count: c });
    }
    const weeks: { date: string; count: number }[][] = [];
    for (let w = 0; w < 53; w++) {
      weeks.push(allDays.slice(w * 7, w * 7 + 7));
    }
    return { weeks, max: Math.max(1, max) };
  }, [counts]);

  const alpha = (c: number) => {
    if (c === 0) return 0.06;
    const ratio = c / max;
    return 0.18 + ratio * 0.72;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Ticket-Aktivität · 52 Wochen
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
                  title={`${day.date}: ${day.count} Tickets`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
          <span>weniger</span>
          {[0.06, 0.25, 0.45, 0.7, 0.9].map((a) => (
            <span
              key={a}
              className="a2-heatmap-day"
              style={{ width: 12, height: 12, ["--a2-cell-alpha" as any]: a }}
            />
          ))}
          <span>mehr</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default ActivityHeatmap;
