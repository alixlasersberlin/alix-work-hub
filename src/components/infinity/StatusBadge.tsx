import { LucideIcon, Circle, Clock, CheckCircle2, XCircle, AlertTriangle, Truck, Wrench, FileCheck, Ban, Loader2, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusKind =
  | "draft"      // grau
  | "open"       // sky
  | "pending"    // amber
  | "progress"   // violet
  | "shipped"    // indigo
  | "done"       // emerald
  | "approved"   // emerald
  | "warning"    // amber
  | "error"      // rose
  | "cancelled"  // grau-rot
  | "onhold"     // amber-grau
  | "neutral";   // grau

interface KindConfig {
  label: string;
  icon: LucideIcon;
  classes: string;
  dot: string;
}

const KINDS: Record<StatusKind, KindConfig> = {
  draft:     { label: "Entwurf",       icon: Circle,        classes: "text-slate-300 border-slate-500/30 bg-slate-500/10",      dot: "bg-slate-400" },
  open:      { label: "Offen",         icon: Circle,        classes: "text-sky-300 border-sky-500/30 bg-sky-500/10",            dot: "bg-sky-400" },
  pending:   { label: "Wartend",       icon: Clock,         classes: "text-amber-300 border-amber-500/30 bg-amber-500/10",      dot: "bg-amber-400" },
  progress:  { label: "In Bearbeitung",icon: Loader2,       classes: "text-violet-300 border-violet-500/30 bg-violet-500/10",   dot: "bg-violet-400" },
  shipped:   { label: "Versendet",     icon: Truck,         classes: "text-indigo-300 border-indigo-500/30 bg-indigo-500/10",   dot: "bg-indigo-400" },
  done:      { label: "Abgeschlossen", icon: CheckCircle2,  classes: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",dot: "bg-emerald-400" },
  approved:  { label: "Freigegeben",   icon: FileCheck,     classes: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",dot: "bg-emerald-400" },
  warning:   { label: "Achtung",       icon: AlertTriangle, classes: "text-amber-300 border-amber-500/40 bg-amber-500/10",      dot: "bg-amber-400" },
  error:     { label: "Fehler",        icon: XCircle,       classes: "text-rose-300 border-rose-500/30 bg-rose-500/10",         dot: "bg-rose-400" },
  cancelled: { label: "Storniert",     icon: Ban,           classes: "text-rose-300/80 border-rose-500/20 bg-rose-500/5",       dot: "bg-rose-400/70" },
  onhold:    { label: "Pausiert",      icon: Pause,         classes: "text-amber-200 border-amber-500/30 bg-amber-500/5",       dot: "bg-amber-300" },
  neutral:   { label: "—",             icon: Circle,        classes: "text-muted-foreground border-border bg-muted/30",         dot: "bg-muted-foreground" },
};

interface StatusBadgeProps {
  kind: StatusKind;
  label?: string;
  size?: "sm" | "md";
  /** show animated pulse dot (for live states) */
  pulse?: boolean;
  /** hide icon, show only dot+label */
  dotOnly?: boolean;
  /** hide both icon and dot */
  bare?: boolean;
  className?: string;
}

export const StatusBadge = ({
  kind,
  label,
  size = "md",
  pulse,
  dotOnly,
  bare,
  className,
}: StatusBadgeProps) => {
  const cfg = KINDS[kind] ?? KINDS.neutral;
  const Icon = cfg.icon;
  const spin = kind === "progress";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium uppercase tracking-wider whitespace-nowrap",
        size === "sm" ? "text-[9px] px-2 py-0.5" : "text-[10px] px-2.5 py-1",
        cfg.classes,
        className
      )}
    >
      {!bare && (dotOnly ? (
        <span className="relative inline-flex">
          <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
          {pulse && (
            <span
              className={cn(
                "absolute inset-0 rounded-full animate-ping opacity-60",
                cfg.dot
              )}
            />
          )}
        </span>
      ) : (
        <Icon className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3", spin && "animate-spin")} />
      ))}
      {label ?? cfg.label}
    </span>
  );
};

/**
 * Map a free-form string (DB status, Zoho status, etc.) to a StatusKind.
 * Falls back to "neutral".
 */
export function mapToStatusKind(s: string | null | undefined): StatusKind {
  if (!s) return "neutral";
  const v = String(s).toLowerCase().trim();
  const map: Record<string, StatusKind> = {
    draft: "draft", entwurf: "draft",
    open: "open", offen: "open", new: "open", neu: "open",
    pending: "pending", wartend: "pending", waiting: "pending", review: "pending",
    in_progress: "progress", inprogress: "progress", "in bearbeitung": "progress", processing: "progress", running: "progress",
    shipped: "shipped", versendet: "shipped", out_for_delivery: "shipped", delivered: "done",
    done: "done", completed: "done", closed: "done", abgeschlossen: "done", erledigt: "done", paid: "done", bezahlt: "done",
    approved: "approved", freigegeben: "approved", confirmed: "approved",
    warning: "warning", overdue: "warning", "überfällig": "warning", ueberfaellig: "warning",
    error: "error", failed: "error", rejected: "error", abgelehnt: "error",
    cancelled: "cancelled", canceled: "cancelled", storniert: "cancelled", void: "cancelled",
    onhold: "onhold", on_hold: "onhold", pausiert: "onhold", hold: "onhold",
  };
  return map[v] ?? "neutral";
}

export const InfinityStatusBadge = StatusBadge;
export default StatusBadge;
