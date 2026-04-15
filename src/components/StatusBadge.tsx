import { cn } from '@/lib/utils';

const STATUS_VARIANTS: Record<string, string> = {
  // General
  offen: 'bg-primary/10 text-primary border-primary/20',
  aktiv: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  abgeschlossen: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  geliefert: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  bezahlt: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  verified: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  accepted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  // Warning
  'in Bearbeitung': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  geplant: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  bestätigt: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  teilweise: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'teilweise bezahlt': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  pending: 'bg-primary/10 text-primary border-primary/20',
  sent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  versendet: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  erstellt: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  // Danger
  storniert: 'bg-destructive/10 text-destructive border-destructive/20',
  abgelehnt: 'bg-destructive/10 text-destructive border-destructive/20',
  überfällig: 'bg-destructive/10 text-destructive border-destructive/20',
  expired: 'bg-destructive/10 text-destructive border-destructive/20',
  blocked: 'bg-destructive/10 text-destructive border-destructive/20',
  disabled: 'bg-muted text-muted-foreground border-border',
  locked: 'bg-destructive/10 text-destructive border-destructive/20',
  // Legal
  anwalt: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  // Priority
  hoch: 'bg-destructive/10 text-destructive border-destructive/20',
  dringend: 'bg-destructive/10 text-destructive border-destructive/20',
  normal: 'bg-muted text-muted-foreground border-border',
  niedrig: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  // Import
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  error: 'bg-destructive/10 text-destructive border-destructive/20',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

interface StatusBadgeProps {
  status: string | null;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = status || '—';
  const key = label.toLowerCase();
  const variant = STATUS_VARIANTS[key] || 'bg-muted text-muted-foreground border-border';

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
      variant,
      className,
    )}>
      {label}
    </span>
  );
}

export function getStatusClass(status: string | null): string {
  if (!status) return 'bg-muted text-muted-foreground border-border';
  return STATUS_VARIANTS[status.toLowerCase()] || 'bg-primary/10 text-primary border-primary/20';
}
