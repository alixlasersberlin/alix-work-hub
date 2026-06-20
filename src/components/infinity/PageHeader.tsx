import { ReactNode, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Manual override. If omitted, breadcrumbs are derived from the URL. */
  breadcrumbs?: BreadcrumbItem[];
  /** Hide auto-breadcrumb derivation entirely. */
  noBreadcrumbs?: boolean;
  /** Right-aligned action area (buttons, filters, etc.) */
  actions?: ReactNode;
  /** Status badge or meta below the title (e.g. <StatusBadge>) */
  meta?: ReactNode;
  className?: string;
}

/** Map URL slugs to human labels. Extend as needed. */
const SLUG_LABELS: Record<string, string> = {
  "": "Start",
  dashboard: "Dashboard",
  customers: "Kunden",
  orders: "Aufträge",
  "orders-at": "Aufträge AT",
  "orders-ch": "Aufträge CH",
  route: "Tourenplanung",
  reparatur: "Reparatur",
  finance: "Finance",
  iso: "ISO 13485 / MDR",
  "bug-capa": "Bug & CAPA",
  tickets: "Tickets",
  portal: "Kundenportal",
  mandanten: "Mandanten",
  konzern: "Konzern",
  einstellungen: "Einstellungen",
  bestellwesen: "Bestellwesen",
  ersatzteile: "Ersatzteile",
  "alix-flex": "Alix Flex",
  raten: "Ratenzahlung",
  mahnwesen: "Mahnwesen",
  datev: "DATEV",
  bank: "Bankimport",
  sepa: "SEPA",
  steuer: "Steuer",
  cockpit: "Cockpit",
};

const humanize = (slug: string) =>
  SLUG_LABELS[slug] ??
  decodeURIComponent(slug)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const PageHeader = ({
  title,
  subtitle,
  icon: Icon,
  breadcrumbs,
  noBreadcrumbs,
  actions,
  meta,
  className,
}: PageHeaderProps) => {
  const location = useLocation();

  const crumbs = useMemo<BreadcrumbItem[]>(() => {
    if (breadcrumbs) return breadcrumbs;
    if (noBreadcrumbs) return [];
    const parts = location.pathname.split("/").filter(Boolean);
    // Skip last segment if it looks like an ID (UUID or pure number)
    const isId = (s: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ||
      /^\d+$/.test(s);
    const visibleParts = parts.filter((p, i) => !(isId(p) && i === parts.length - 1));
    const acc: BreadcrumbItem[] = [];
    let path = "";
    visibleParts.forEach((p, i) => {
      path += `/${p}`;
      acc.push({ label: humanize(p), href: i < visibleParts.length - 1 ? path : undefined });
    });
    return acc;
  }, [breadcrumbs, noBreadcrumbs, location.pathname]);

  return (
    <header className={cn("relative mb-6", className)}>
      {/* Breadcrumbs */}
      {crumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-[11px] text-muted-foreground mb-3"
        >
          <Link
            to="/dashboard"
            className="flex items-center gap-1 hover:text-amber-300 transition-colors"
            aria-label="Start"
          >
            <Home className="h-3 w-3" />
          </Link>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 opacity-50" />
              {c.href ? (
                <Link to={c.href} className="hover:text-amber-300 transition-colors">
                  {c.label}
                </Link>
              ) : (
                <span className="text-foreground/80 font-medium">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="shrink-0 grid place-items-center h-11 w-11 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-400/15 to-amber-600/5 shadow-[0_0_30px_rgba(245,158,11,0.12)]">
              <Icon className="h-5 w-5 text-amber-300" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              {meta && <span className="flex items-center gap-2">{meta}</span>}
            </div>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{subtitle}</p>
            )}
          </div>
        </div>

        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>

      {/* Subtle gold divider */}
      <div
        aria-hidden="true"
        className="mt-5 h-px bg-gradient-to-r from-transparent via-amber-500/25 to-transparent"
      />
    </header>
  );
};

export default PageHeader;
