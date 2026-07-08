import { addDays, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import type { EscAppointment, EscDepartment } from '@/lib/esc/types';
import { cn } from '@/lib/utils';

export function MonthView({
  date, appointments, departments, onDayClick, onAppointmentClick,
}: {
  date: Date;
  appointments: EscAppointment[];
  departments: EscDepartment[];
  onDayClick?: (d: Date) => void;
  onAppointmentClick?: (a: EscAppointment) => void;
}) {
  const monthStart = startOfMonth(date);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  const deptOf = (id: string) => departments.find((d) => d.id === id);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="grid grid-cols-7 text-[11px] font-medium bg-muted/30">
        {['Mo','Di','Mi','Do','Fr','Sa','So'].map((d) => (
          <div key={d} className="px-2 py-1.5 border-r last:border-r-0">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const inMonth = isSameMonth(d, date);
          const items = appointments.filter((a) => isSameDay(new Date(a.startAt), d));
          return (
            <div
              key={d.toISOString()}
              className={cn(
                'border-t border-r last:border-r-0 min-h-[92px] p-1 text-[11px] cursor-pointer',
                !inMonth && 'bg-muted/20 text-muted-foreground',
                'hover:bg-accent/20',
              )}
              onClick={() => onDayClick?.(d)}
            >
              <div className="font-medium mb-1">{format(d, 'd', { locale: de })}</div>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 3).map((a) => {
                  const dept = deptOf(a.departmentId);
                  return (
                    <button
                      key={a.id}
                      onClick={(e) => { e.stopPropagation(); onAppointmentClick?.(a); }}
                      className="text-left truncate rounded px-1 py-0.5 border-l-2 bg-card hover:bg-accent/30"
                      style={{ borderLeftColor: dept?.color || 'hsl(var(--primary))' }}
                    >
                      {format(new Date(a.startAt), 'HH:mm')} {a.title}
                    </button>
                  );
                })}
                {items.length > 3 && <div className="text-muted-foreground pl-1">+ {items.length - 3} weitere</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
