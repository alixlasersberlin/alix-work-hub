import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import type { EscAppointment, EscDepartment } from '@/lib/esc/types';
import { AppointmentCard } from '../AppointmentCard';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function WeekView({
  date, appointments, departments, onSlotClick, onAppointmentClick, onDropAppointment,
}: {
  date: Date;
  appointments: EscAppointment[];
  departments: EscDepartment[];
  onSlotClick?: (start: Date) => void;
  onAppointmentClick?: (a: EscAppointment) => void;
  onDropAppointment?: (id: string, newStart: Date) => void;
}) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const deptOf = (id: string) => departments.find((d) => d.id === id);
  const [dragOver, setDragOver] = useState<string | null>(null);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b">
        {days.map((d) => (
          <div key={d.toISOString()} className="px-2 py-2 border-r last:border-r-0 bg-muted/30 text-[12px]">
            <div className="font-medium">{format(d, 'EEE', { locale: de })}</div>
            <div className="text-muted-foreground">{format(d, 'dd.MM.', { locale: de })}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 min-h-[420px]">
        {days.map((d) => {
          const items = appointments
            .filter((a) => isSameDay(new Date(a.startAt), d))
            .sort((a, b) => a.startAt.localeCompare(b.startAt));
          const key = d.toISOString();
          return (
            <div
              key={key}
              className={cn(
                'border-r last:border-r-0 p-1 flex flex-col gap-1 cursor-pointer transition-colors',
                dragOver === key ? 'bg-primary/10' : 'hover:bg-accent/10',
              )}
              onClick={() => {
                const s = new Date(d); s.setHours(9, 0, 0, 0);
                onSlotClick?.(s);
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(key); }}
              onDragLeave={() => setDragOver((k) => (k === key ? null : k))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = e.dataTransfer.getData('text/esc-id');
                if (!id) return;
                const orig = appointments.find((a) => a.id === id);
                if (!orig) return;
                const s = new Date(orig.startAt);
                const newStart = new Date(d);
                newStart.setHours(s.getHours(), s.getMinutes(), 0, 0);
                onDropAppointment?.(id, newStart);
              }}
            >
              {items.map((a) => (
                <div
                  key={a.id}
                  draggable={!!onDropAppointment}
                  onDragStart={(e) => { e.dataTransfer.setData('text/esc-id', a.id); e.dataTransfer.effectAllowed = 'move'; }}
                >
                  <AppointmentCard appointment={a} department={deptOf(a.departmentId)} compact onClick={() => onAppointmentClick?.(a)} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
