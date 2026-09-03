/**
 * ALIXWORK MOBILE – Design-System-Bausteine (Prompt 8).
 *
 * Reine Präsentationsschicht: einheitliche Sektionen, Karten, Status-Chips,
 * Skeletons, Empty-/Error-States, Pills und Pull-to-Refresh.
 * Keine Datenlogik, keine Backend-Aufrufe.
 */
import * as React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/mobil/haptics';

/* ---------------------------------------------------------------- Struktur */

export function MobilPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-4 py-4 space-y-5 mx-auto w-full max-w-3xl lg:max-w-5xl', className)}>{children}</div>;
}

export function SectionLabel({
  children, action,
}: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}

/** Karte mit einheitlichem Radius, dezenter Elevation und Tap-Feedback. */
export function MobilCard({
  children, className, onClick, tone = 'default', ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  tone?: 'default' | 'critical' | 'warning' | 'muted';
  ariaLabel?: string;
}) {
  const toneCls =
    tone === 'critical' ? 'border-destructive/45 bg-destructive/[0.06]'
    : tone === 'warning' ? 'border-amber-500/40 bg-amber-500/[0.06]'
    : tone === 'muted' ? 'bg-muted/30'
    : '';
  const base = cn('rounded-2xl border-border/70 shadow-sm', toneCls, className);
  if (!onClick) return <Card className={base}>{children}</Card>;
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={() => { haptic('light'); onClick(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={cn(base, 'cursor-pointer transition-transform duration-150 active:scale-[0.985] active:bg-muted/40 motion-reduce:transition-none motion-reduce:active:scale-100')}
    >
      {children}
    </Card>
  );
}

/* ------------------------------------------------------------------- Pills */

export function Pill({
  active, children, onClick, ariaLabel,
}: { active?: boolean; children: React.ReactNode; onClick: () => void; ariaLabel?: string }) {
  return (
    <button
      type="button"
      aria-pressed={!!active}
      aria-label={ariaLabel}
      onClick={() => { haptic('light'); onClick(); }}
      className={cn(
        'shrink-0 rounded-full px-3.5 min-h-[36px] text-xs font-medium border transition-colors duration-150',
        active
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-border/80 bg-muted/30 text-muted-foreground active:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

export function PillRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">{children}</div>;
}

/* ------------------------------------------------------------------ Status */

export type Prio = 'P1' | 'P2' | 'P3' | 'P4';

const PRIO_META: Record<Prio, { label: string; cls: string }> = {
  P1: { label: 'Kritisch', cls: 'border-destructive/50 bg-destructive/12 text-destructive' },
  P2: { label: 'Hoch', cls: 'border-amber-500/50 bg-amber-500/12 text-amber-600 dark:text-amber-400' },
  P3: { label: 'Normal', cls: 'border-border bg-muted/50 text-muted-foreground' },
  P4: { label: 'Niedrig', cls: 'border-border bg-muted/30 text-muted-foreground' },
};

/** Priorität nie nur über Farbe: immer Kürzel + Text. */
export function PrioBadge({ prio, compact }: { prio: string | null | undefined; compact?: boolean }) {
  const p = (String(prio || 'P3').toUpperCase() as Prio) in PRIO_META ? (String(prio).toUpperCase() as Prio) : 'P3';
  const meta = PRIO_META[p];
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', meta.cls)}
      aria-label={`Priorität ${p} – ${meta.label}`}
    >
      {p === 'P1' && <AlertTriangle className="h-3 w-3" aria-hidden />}
      {p}{!compact && <span className="font-medium opacity-80">· {meta.label}</span>}
    </span>
  );
}

export function StatusChip({
  children, tone = 'neutral', icon: Icon,
}: { children: React.ReactNode; tone?: 'neutral' | 'positive' | 'warning' | 'critical' | 'info'; icon?: LucideIcon }) {
  const cls = {
    neutral: 'border-border bg-muted/50 text-muted-foreground',
    positive: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    warning: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    critical: 'border-destructive/45 bg-destructive/10 text-destructive',
    info: 'border-primary/40 bg-primary/10 text-primary',
  }[tone];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', cls)}>
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  );
}

/** Kompakter Zähler-Badge (Unread, Anzahl). */
export function CountBadge({ n, tone = 'primary' }: { n: number; tone?: 'primary' | 'critical' }) {
  if (!n) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full px-1.5 min-w-[20px] h-5 text-[11px] font-semibold tabular-nums',
        tone === 'critical' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground',
      )}
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}

/* ------------------------------------------------------------------ States */

export function ListSkeleton({ rows = 4, height = 84 }: { rows?: number; height?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Inhalte werden geladen">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border/60 bg-muted/40 animate-pulse motion-reduce:animate-none"
          style={{ height }}
        />
      ))}
    </div>
  );
}

export function GridSkeleton({ cells = 6, height = 88 }: { cells?: number; height?: number }) {
  return (
    <div className="grid grid-cols-3 gap-2" aria-busy="true">
      {Array.from({ length: cells }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/60 bg-muted/40 animate-pulse motion-reduce:animate-none" style={{ height }} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon, title, hint, action,
}: { icon: LucideIcon; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border-border/70 p-8 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted/60">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  );
}

export function ErrorState({
  title = 'Daten konnten nicht geladen werden.', hint, onRetry,
}: { title?: string; hint?: string; onRetry?: () => void }) {
  return (
    <Card className="rounded-2xl border-destructive/40 p-6 text-center animate-[shake_220ms_ease-in-out] motion-reduce:animate-none">
      <AlertTriangle className="mx-auto h-5 w-5 text-destructive" aria-hidden />
      <div className="mt-2 text-sm font-semibold">{title}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {onRetry && (
        <Button variant="outline" className="mt-4 h-10" onClick={() => { haptic('medium'); onRetry(); }}>
          <RefreshCw className="mr-2 h-4 w-4" /> Erneut versuchen
        </Button>
      )}
    </Card>
  );
}

/* ------------------------------------------------------- Pull to Refresh */

export function PullToRefresh({
  onRefresh, refreshing, children,
}: { onRefresh: () => void; refreshing?: boolean; children: React.ReactNode }) {
  const startY = React.useRef(0);
  const [pull, setPull] = React.useState(0);
  const THRESHOLD = 72;

  return (
    <div
      onTouchStart={(e) => { startY.current = e.touches[0].clientY; }}
      onTouchMove={(e) => {
        if (window.scrollY > 0) return;
        const dy = e.touches[0].clientY - startY.current;
        if (dy > 0) setPull(Math.min(dy * 0.45, 96));
      }}
      onTouchEnd={() => {
        if (pull >= THRESHOLD && !refreshing) { haptic('medium'); onRefresh(); }
        setPull(0);
      }}
    >
      <div
        className="flex items-center justify-center overflow-hidden text-[11px] text-muted-foreground transition-[height] duration-150 motion-reduce:transition-none"
        style={{ height: refreshing ? 32 : pull }}
        aria-hidden={!refreshing && pull === 0}
      >
        <RefreshCw className={cn('h-4 w-4', (refreshing || pull >= THRESHOLD) && 'animate-spin motion-reduce:animate-none')} />
        <span className="ml-2">{refreshing ? 'Wird aktualisiert …' : pull >= THRESHOLD ? 'Loslassen zum Aktualisieren' : 'Zum Aktualisieren ziehen'}</span>
      </div>
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- Quick tile */

export function QuickTile({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link to={to} onClick={() => haptic('light')} aria-label={label}>
      <Card className="rounded-2xl border-border/70 p-3 min-h-[76px] flex flex-col items-center justify-center gap-1.5 transition-transform duration-150 active:scale-[0.97] active:bg-muted/40 motion-reduce:transition-none motion-reduce:active:scale-100">
        <Icon className="h-5 w-5 text-primary" aria-hidden />
        <span className="text-xs font-medium text-center leading-tight">{label}</span>
      </Card>
    </Link>
  );
}

/** Hebt den Suchbegriff dezent hervor (rein visuell). */
export function Highlight({ text, term }: { text: string; term: string }) {
  const t = term.trim();
  if (!t || t.length < 2) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(t.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/15 text-foreground rounded-[3px] px-0.5">{text.slice(idx, idx + t.length)}</mark>
      {text.slice(idx + t.length)}
    </>
  );
}
