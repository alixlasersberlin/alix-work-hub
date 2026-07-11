import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { EscAppointment, EscDepartment } from '@/lib/esc/types';
import { EscStatusBadge } from '../StatusBadge';
import { DepartmentBadge } from '../DepartmentBadge';
import { AddToCalendarMenu } from '../AddToCalendarMenu';


export function AgendaView({
  appointments, departments, onAppointmentClick,
}: {
  appointments: EscAppointment[];
  departments: EscDepartment[];
  onAppointmentClick?: (a: EscAppointment) => void;
}) {
  const sorted = [...appointments].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const deptOf = (id: string) => departments.find((d) => d.id === id);

  return (
    <div className="rounded-lg border bg-card divide-y">
      {sorted.length === 0 && (
        <div className="p-6 text-center text-sm text-muted-foreground">Keine Termine im Zeitraum.</div>
      )}
      {sorted.map((a) => (
        <div key={a.id} className="flex items-center gap-3 p-3 hover:bg-accent/20 cursor-pointer" onClick={() => onAppointmentClick?.(a)}>
          <div className="text-[12px] font-medium min-w-[130px]">
            {format(new Date(a.startAt), 'EEE dd.MM. HH:mm', { locale: de })}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate">{a.title}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {a.customerName || '—'} · {a.location || a.address || '—'}
            </div>
          </div>
          <DepartmentBadge dept={deptOf(a.departmentId)} />
          <EscStatusBadge status={a.status} />
          <AddToCalendarMenu appointment={a} size="sm" variant="ghost" label="" />

        </div>
      ))}
    </div>
  );
}
