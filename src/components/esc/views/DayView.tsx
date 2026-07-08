import { format, isSameDay, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import type { EscAppointment, EscDepartment } from '@/lib/esc/types';
import { AppointmentCard } from '../AppointmentCard';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 07-19

export function DayView({
  date, appointments, departments, onSlotClick, onAppointmentClick, onDropAppointment,
}: {
  date: Date;
  appointments: EscAppointment[];
  departments: EscDepartment[];
  onSlotClick?: (start: Date) => void;
  onAppointmentClick?: (a: EscAppointment) => void;
  onDropAppointment?: (id: string, newStart: Date) => void;
}) {
  const day = startOfDay(date);
  const items = appointments.filter((a) => isSameDay(new Date(a.startAt), day));
  const deptOf = (id: string) => departments.find((d) => d.id === id);
  const [dragHour, setDragHour] = useState<number | null>(null);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b bg-muted/30 text-[13px] font-medium">
        {format(day, 'EEEE, dd. MMMM yyyy', { locale: de })}
      </div>
      <div className="grid grid-cols-[64px_1fr]">
        {HOURS.map((h) => {
          const slotStart = new Date(day);
          slotStart.setHours(h, 0, 0, 0);
          const inSlot = items.filter((a) => new Date(a.startAt).getHours() === h);
          return (
            <div key={h} className="contents">
              <div className="border-t border-r px-2 py-2 text-[11px] text-muted-foreground text-right">{h}:00</div>
              <div
                className={cn('border-t px-2 py-1 min-h-[56px] cursor-pointer transition-colors', dragHour === h ? 'bg-primary/10' : 'hover:bg-accent/20')}
                onClick={() => onSlotClick?.(slotStart)}
                onDragOver={(e) => { e.preventDefault(); setDragHour(h); }}
                onDragLeave={() => setDragHour((v) => (v === h ? null : v))}
                onDrop={(e) => {
                  e.preventDefault(); setDragHour(null);
                  const id = e.dataTransfer.getData('text/esc-id');
                  if (id) onDropAppointment?.(id, slotStart);
                }}
              >
                <div className="flex flex-col gap-1">
                  {inSlot.map((a) => (
                    <div
                      key={a.id}
                      draggable={!!onDropAppointment}
                      onDragStart={(e) => { e.dataTransfer.setData('text/esc-id', a.id); }}
                      onClick={(e) => { e.stopPropagation(); onAppointmentClick?.(a); }}
                    >
                      <AppointmentCard appointment={a} department={deptOf(a.departmentId)} />
                    </div>
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
