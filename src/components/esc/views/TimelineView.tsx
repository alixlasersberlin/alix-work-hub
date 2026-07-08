import { useMemo } from 'react';
import { addDays, differenceInMinutes, format, isSameDay, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import type { EscAppointment, EscDepartment, EscEmployee } from '@/lib/esc/types';
import { cn } from '@/lib/utils';

const HOUR_START = 7;
const HOUR_END = 20;
const HOUR_WIDTH = 72; // px per hour
const TOTAL_HOURS = HOUR_END - HOUR_START;

interface Props {
  date: Date;
  appointments: EscAppointment[];
  departments: EscDepartment[];
  employees: EscEmployee[];
  onAppointmentClick?: (a: EscAppointment) => void;
}

export function TimelineView({ date, appointments, departments, employees, onAppointmentClick }: Props) {
  const day = startOfDay(date);
  const activeEmployees = useMemo(() => employees.filter((e) => e.active), [employees]);

  const deptColor = (id: string) => departments.find((d) => d.id === id)?.color || 'hsl(var(--primary))';

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b bg-muted/30 text-[13px] font-medium flex items-center justify-between">
        <span>Timeline · {format(day, 'EEEE, dd. MMMM yyyy', { locale: de })}</span>
        <span className="text-[11px] text-muted-foreground">{HOUR_START}:00 – {HOUR_END}:00</span>
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: 200 + TOTAL_HOURS * HOUR_WIDTH }}>
          {/* Header row: hours */}
          <div className="grid" style={{ gridTemplateColumns: `200px 1fr` }}>
            <div className="border-r bg-muted/30 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">Mitarbeiter</div>
            <div className="relative h-8 bg-muted/20 border-b">
              {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l text-[10px] text-muted-foreground pl-1"
                  style={{ left: i * HOUR_WIDTH }}
                >
                  {HOUR_START + i}:00
                </div>
              ))}
            </div>
          </div>

          {activeEmployees.map((emp) => {
            const items = appointments.filter((a) =>
              isSameDay(new Date(a.startAt), day) && a.employeeIds.includes(emp.id),
            );
            return (
              <div key={emp.id} className="grid border-b" style={{ gridTemplateColumns: `200px 1fr` }}>
                <div className="border-r px-3 py-2 text-[12px] flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: emp.color || 'hsl(var(--primary))' }} />
                  <div>
                    <div className="font-medium truncate">{emp.name}</div>
                    <div className="text-[10.5px] text-muted-foreground truncate">{emp.role}</div>
                  </div>
                </div>
                <div className="relative h-14">
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-l border-border/40" style={{ left: i * HOUR_WIDTH }} />
                  ))}
                  {items.map((a) => {
                    const s = new Date(a.startAt);
                    const e = new Date(a.endAt);
                    const startMin = s.getHours() * 60 + s.getMinutes() - HOUR_START * 60;
                    const dur = differenceInMinutes(e, s);
                    const left = Math.max(0, (startMin / 60) * HOUR_WIDTH);
                    const width = Math.max(40, (dur / 60) * HOUR_WIDTH);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onAppointmentClick?.(a)}
                        className={cn(
                          'absolute top-1 bottom-1 rounded-md border-l-4 bg-accent/30 hover:bg-accent/60 transition-colors px-2 py-1 text-left text-[11px]',
                        )}
                        style={{ left, width, borderLeftColor: deptColor(a.departmentId) }}
                        title={a.title}
                      >
                        <div className="font-medium truncate">{a.title}</div>
                        <div className="text-muted-foreground truncate">{format(s, 'HH:mm')}–{format(e, 'HH:mm')} · {a.customerName || ''}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
