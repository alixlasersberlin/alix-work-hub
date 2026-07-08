import type { EscAppointment, EscDepartment } from '@/lib/esc/types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { EscStatusBadge } from './StatusBadge';
import { DepartmentBadge } from './DepartmentBadge';
import { cn } from '@/lib/utils';

interface Props {
  appointment: EscAppointment;
  department?: EscDepartment;
  compact?: boolean;
  onClick?: () => void;
}

export function AppointmentCard({ appointment, department, compact, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-md border bg-card hover:bg-accent/40 transition-colors px-2 py-1.5',
        'border-l-4',
        compact ? 'text-[11px]' : 'text-[12.5px]',
      )}
      style={{ borderLeftColor: department?.color || 'hsl(var(--primary))' }}
      title={appointment.title}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium truncate">{appointment.title}</span>
        {!compact && <EscStatusBadge status={appointment.status} />}
      </div>
      <div className="flex items-center justify-between text-muted-foreground mt-0.5">
        <span>{format(new Date(appointment.startAt), 'HH:mm', { locale: de })}–{format(new Date(appointment.endAt), 'HH:mm', { locale: de })}</span>
        {!compact && <DepartmentBadge dept={department} />}
      </div>
      {!compact && appointment.customerName && (
        <div className="text-muted-foreground truncate">{appointment.customerName}</div>
      )}
    </button>
  );
}
