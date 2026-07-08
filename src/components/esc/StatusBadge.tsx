import { Badge } from '@/components/ui/badge';
import type { EscStatus } from '@/lib/esc/types';
import { cn } from '@/lib/utils';

const LABEL: Record<EscStatus, string> = {
  geplant: 'Geplant',
  angefragt: 'Angefragt',
  bestaetigung_offen: 'Bestätigung offen',
  bestaetigt: 'Bestätigt',
  abgelehnt: 'Abgelehnt',
  verschoben: 'Verschoben',
  storniert: 'Storniert',
  abgeschlossen: 'Abgeschlossen',
  nicht_erschienen: 'Nicht erschienen',
};

const CLS: Record<EscStatus, string> = {
  geplant: 'bg-muted text-foreground',
  angefragt: 'bg-primary/15 text-primary border-primary/30',
  bestaetigung_offen: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  bestaetigt: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30',
  abgelehnt: 'bg-destructive/15 text-destructive border-destructive/30',
  verschoben: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  storniert: 'bg-muted text-muted-foreground line-through',
  abgeschlossen: 'bg-secondary text-secondary-foreground',
  nicht_erschienen: 'bg-destructive/10 text-destructive border-destructive/20',
};

export function EscStatusBadge({ status, className }: { status: EscStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium', CLS[status], className)}>
      {LABEL[status]}
    </Badge>
  );
}

export const ESC_STATUS_LABELS = LABEL;
