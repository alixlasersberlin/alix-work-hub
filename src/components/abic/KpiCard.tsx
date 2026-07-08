import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatKpi } from "@/lib/abic/format";
import type { Kpi } from "@/lib/abic/types";
import { Link } from "react-router-dom";

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const trend = kpi.trend ?? "flat";
  const delta = kpi.delta ?? 0;
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendClass =
    trend === "up" ? "text-emerald-500" :
    trend === "down" ? "text-rose-500" : "text-muted-foreground";

  const inner = (
    <Card className="group relative overflow-hidden border-border/60 bg-card/60 backdrop-blur hover:border-primary/40 transition-colors">
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent transition-opacity" />
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</div>
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <div className="text-2xl font-semibold tabular-nums">
            {formatKpi(kpi.value, kpi.format, kpi.unit)}
          </div>
          {kpi.delta !== undefined && (
            <div className={cn("flex items-center gap-0.5 text-xs font-medium", trendClass)}>
              <TrendIcon className="h-3.5 w-3.5" />
              {Math.abs(delta).toFixed(1)}%
            </div>
          )}
        </div>
        {kpi.target !== undefined && kpi.actual !== undefined && (
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-yellow-500"
              style={{ width: `${Math.min(100, (kpi.actual / Math.max(1, kpi.target)) * 100)}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );

  return kpi.drill ? <Link to={kpi.drill} className="block">{inner}</Link> : inner;
}
