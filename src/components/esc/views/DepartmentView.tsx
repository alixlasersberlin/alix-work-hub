import type { EscAppointment, EscDepartment } from '@/lib/esc/types';
import { AppointmentCard } from '../AppointmentCard';
import { DepartmentBadge } from '../DepartmentBadge';

export function DepartmentView({
  appointments, departments, onAppointmentClick,
}: {
  appointments: EscAppointment[];
  departments: EscDepartment[];
  onAppointmentClick?: (a: EscAppointment) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {departments.filter((d) => d.active).map((d) => {
        const items = appointments.filter((a) => a.departmentId === d.id).sort((a, b) => a.startAt.localeCompare(b.startAt));
        return (
          <div key={d.id} className="rounded-lg border bg-card">
            <div className="flex items-center justify-between p-2 border-b bg-muted/30">
              <DepartmentBadge dept={d} size="md" />
              <span className="text-[11px] text-muted-foreground">{items.length} Termine</span>
            </div>
            <div className="p-2 space-y-1.5">
              {items.length === 0 && <div className="text-[12px] text-muted-foreground px-2 py-3 text-center">Keine Termine</div>}
              {items.map((a) => (
                <AppointmentCard key={a.id} appointment={a} department={d} onClick={() => onAppointmentClick?.(a)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
