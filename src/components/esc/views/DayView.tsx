import { format, isSameDay, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import type { EscAppointment, EscDepartment } from '@/lib/esc/types';
import { AppointmentCard } from '../AppointmentCard';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 07:00 - 19:00

export function DayView({
  date, appointments, departments, onSlotClick, onAppointmentClick,
}: {
  date: Date;
  appointments: EscAppointment[];
  departments: EscDepartment[];
  onSlotClick?: (start: Date) => void;
  onAppointmentClick?: (a: EscAppointment) => void;
}) {
  const day = startOfDay(date);
  const items = appointments.filter((a) => isSameDay(new Date(a.startAt), day));
  const deptOf = (id: string) => departments.find((d) => d.id === id);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b bg-muted/30 text-[13px] font-medium">
        {format(day, 'EEEE, dd. MMMM yyyy', { locale: de })}
      </div>
      <div className="grid grid-cols-[64px_1fr]">
        {HOURS.map((h) => {
          const slotStart = new Date(day);
          slotStart.setHours(h, 0, 0, 0);
          const slotEnd = new Date(day);
          slotEnd.setHours(h + 1, 0, 0, 0);
          const inSlot = items.filter((a) => {
            const s = new Date(a.startAt); return s.getHours() === h;
          });
          return (
            <div key={h} className="contents">
              <div className="border-t border-r px-2 py-2 text-[11px] text-muted-foreground text-right">{h}:00</div>
              <div
                className="border-t px-2 py-1 min-h-[56px] hover:bg-accent/20 cursor-pointer"
                onClick={() => onSlotClick?.(slotStart)}
              >
                <div className="flex flex-col gap-1">
                  {inSlot.map((a) => (
                    <AppointmentCard
                      key={a.id}
                      appointment={a}
                      department={deptOf(a.departmentId)}
                      onClick={() => onAppointmentClick?.(a)}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
