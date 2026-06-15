import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiTileProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: LucideIcon;
  /** Percentage delta vs. previous period (e.g. 12.4 for +12.4%) */
  delta?: number;
  /** Higher delta is good (default) or bad (e.g. for "overdue") */
  deltaInverted?: boolean;
  /** Optional sparkline values, normalized internally */
  trend?: number[];
  /** Override accent color: default gold */
  accent?: "gold" | "sky" | "emerald" | "rose" | "violet";
  onClick?: () => void;
  className?: string;
}

const ACCENT: Record<NonNullable<KpiTileProps["accent"]>, { ring: string; halo: string; text: string; stroke: string }> = {
  gold:    { ring: "border-amber-500/25",  halo: "from-amber-400/20 to-amber-600/5",  text: "text-amber-300",  stroke: "stroke-amber-400" },
  sky:     { ring: "border-sky-500/25",    halo: "from-sky-400/20 to-sky-600/5",      text: "text-sky-300",    stroke: "stroke-sky-400" },
  emerald: { ring: "border-emerald-500/25",halo: "from-emerald-400/20 to-emerald-600/5", text: "text-emerald-300", stroke: "stroke-emerald-400" },
  rose:    { ring: "border-rose-500/25",   halo: "from-rose-400/20 to-rose-600/5",    text: "text-rose-300",   stroke: "stroke-rose-400" },
  violet:  { ring: "border-violet-500/25", halo: "from-violet-400/20 to-violet-600/5",text: "text-violet-300", stroke: "stroke-violet-400" },
};

const Sparkline = ({ values, strokeClass }: { values: number[]; strokeClass: string }) => {
  if (!values.length) return null;
  const w = 100;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(2)},${(h - ((v - min) / range) * h).toFixed(2)}`).join(" ");
  const area = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7" preserveAspectRatio="none" aria-hidden="true">
      <polygon points={area} className={cn("fill-current opacity-15", strokeClass)} />
      <polyline points={pts} fill="none" strokeWidth="1.5" className={strokeClass} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const KpiTile = ({
  label,
  value,
  unit,
  icon: Icon,
  delta,
  deltaInverted = false,
  trend,
  accent = "gold",
  onClick,
  className,
}: KpiTileProps) => {
  const a = ACCENT[accent];
  const isUp = (delta ?? 0) > 0;
  const isDown = (delta ?? 0) < 0;
  const good = deltaInverted ? isDown : isUp;
  const bad = deltaInverted ? isUp : isDown;
  const DeltaIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-background/40 backdrop-blur p-5",
        "transition-all duration-300",
        a.ring,
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60", a.halo)} />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
            {label}
          </span>
          {Icon && (
            <div className={cn("grid place-items-center h-8 w-8 rounded-xl border", a.ring, "bg-background/60")}>
              <Icon className={cn("h-4 w-4", a.text)} />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tracking-tight tabular-nums">{value}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 min-h-[28px]">
          {typeof delta === "number" ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md border",
                good && "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
                bad && "text-rose-300 border-rose-500/30 bg-rose-500/10",
                !good && !bad && "text-muted-foreground border-border bg-muted/30"
              )}
            >
              <DeltaIcon className="h-3 w-3" />
              {isUp ? "+" : ""}
              {delta.toFixed(1)}%
            </span>
          ) : (
            <span />
          )}
          {trend && trend.length > 1 && (
            <div className="flex-1 max-w-[120px]">
              <Sparkline values={trend} strokeClass={a.stroke} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KpiTile;
