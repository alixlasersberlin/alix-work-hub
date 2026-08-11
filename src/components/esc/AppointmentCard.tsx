import type { EscAppointment, EscDepartment } from '@/lib/esc/types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { EscStatusBadge } from './StatusBadge';
import { DepartmentBadge } from './DepartmentBadge';
import { cn } from '@/lib/utils';
import { ReleaseStatusForOrderText } from '@/components/delivery/ReleaseStatusForOrderText';
import { isVipTraining, VIP_TRAINING_COLOR } from '@/lib/esc/vip-kind';
import { ConfirmBanner } from './ConfirmBanner';

interface Props {
  appointment: EscAppointment;
  department?: EscDepartment;
  compact?: boolean;
  onClick?: () => void;
}

export function AppointmentCard({ appointment, department, compact, onClick }: Props) {
  const vip = isVipTraining(appointment);
  return (
    <button
      type="button"
      onClick={(event) => {
        if (!onClick) return;
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'w-full text-left rounded-md border transition-colors px-2 py-1.5',
        'border-l-4',
        vip
          ? 'bg-emerald-500/20 border-emerald-500/60 hover:bg-emerald-500/30'
          : 'bg-card hover:bg-accent/40',
        compact ? 'text-[11px]' : 'text-[12.5px]',
      )}
      style={{ borderLeftColor: vip ? VIP_TRAINING_COLOR : department?.color || 'hsl(var(--primary))' }}
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
      <div className="mt-0.5">
        <ReleaseStatusForOrderText
          texts={[appointment.title, (appointment as any).description, appointment.customerName]}
          withLabel={!compact}
        />
      </div>
    </button>
  );
}
