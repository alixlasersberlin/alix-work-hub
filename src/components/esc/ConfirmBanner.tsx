import type { EscAppointment } from '@/lib/esc/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Zeigt an, ob ein Termin vom Kunden bestätigt wurde.
 * Grün = Bestätigt, Rot = Offen.
 */
export function ConfirmBanner({
  appointment,
  compact,
  className,
}: {
  appointment: EscAppointment;
  compact?: boolean;
  className?: string;
}) {
  const relevant = appointment.confirmationRequired
    || ['bestaetigt', 'bestaetigung_offen', 'angefragt'].includes(appointment.status);
  if (!relevant) return null;

  const confirmed = appointment.status === 'bestaetigt';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold border',
        compact ? 'text-[10px]' : 'text-[11px]',
        confirmed
          ? 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/40'
          : 'bg-destructive/15 text-destructive border-destructive/40',
        className,
      )}
    >
      {confirmed ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {confirmed ? 'Bestätigt' : 'Offen'}
    </span>
  );
}
