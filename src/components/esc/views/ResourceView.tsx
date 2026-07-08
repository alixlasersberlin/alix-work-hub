import type { EscAppointment, EscDepartment, EscResource } from '@/lib/esc/types';
import { AppointmentCard } from '../AppointmentCard';

export function ResourceView({
  appointments, resources, departments, onAppointmentClick,
}: {
  appointments: EscAppointment[];
  resources: EscResource[];
  departments: EscDepartment[];
  onAppointmentClick?: (a: EscAppointment) => void;
}) {
  const deptOf = (id: string) => departments.find((d) => d.id === id);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {resources.filter((r) => r.active).map((res) => {
        const items = appointments.filter((a) => a.resourceId === res.id).sort((a, b) => a.startAt.localeCompare(b.startAt));
        return (
          <div key={res.id} className="rounded-lg border bg-card">
            <div className="flex items-center justify-between p-2 border-b bg-muted/30">
              <div>
                <div className="text-[13px] font-medium">{res.name}</div>
                <div className="text-[11px] text-muted-foreground">{res.type}{res.location ? ` · ${res.location}` : ''}</div>
              </div>
              <span className="text-[11px] text-muted-foreground">{items.length} Termine</span>
            </div>
            <div className="p-2 space-y-1.5">
              {items.length === 0 && <div className="text-[12px] text-muted-foreground px-2 py-3 text-center">Keine Termine</div>}
              {items.map((a) => (
                <AppointmentCard key={a.id} appointment={a} department={deptOf(a.departmentId)} onClick={() => onAppointmentClick?.(a)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
