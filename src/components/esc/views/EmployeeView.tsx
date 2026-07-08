import type { EscAppointment, EscDepartment, EscEmployee } from '@/lib/esc/types';
import { AppointmentCard } from '../AppointmentCard';

export function EmployeeView({
  appointments, employees, departments, onAppointmentClick,
}: {
  appointments: EscAppointment[];
  employees: EscEmployee[];
  departments: EscDepartment[];
  onAppointmentClick?: (a: EscAppointment) => void;
}) {
  const deptOf = (id: string) => departments.find((d) => d.id === id);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {employees.filter((e) => e.active).map((emp) => {
        const items = appointments.filter((a) => a.employeeIds.includes(emp.id)).sort((a, b) => a.startAt.localeCompare(b.startAt));
        return (
          <div key={emp.id} className="rounded-lg border bg-card">
            <div className="flex items-center justify-between p-2 border-b bg-muted/30">
              <div>
                <div className="text-[13px] font-medium">{emp.name}</div>
                <div className="text-[11px] text-muted-foreground">{emp.role}</div>
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
