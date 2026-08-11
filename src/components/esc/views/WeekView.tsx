import { addDays, differenceInCalendarDays, format, isSameDay, startOfWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import type { EscAppointment, EscDepartment } from '@/lib/esc/types';
import { AppointmentCard } from '../AppointmentCard';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { isVipTraining, VIP_TRAINING_COLOR } from '@/lib/esc/vip-kind';

function hueFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}
function subtleTint(id: string) {
  const h = hueFromId(id);
  return { bg: `hsla(${h} 60% 55% / 0.12)`, border: `hsla(${h} 60% 55% / 0.55)` };
}

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
  const weekEnd = addDays(start, 6);
  const deptOf = (id: string) => departments.find((d) => d.id === id);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Split multi-day (spanning >1 calendar day within week) from single-day
  type Span = { a: EscAppointment; colStart: number; colEnd: number; continuesLeft: boolean; continuesRight: boolean };
  const spans: Span[] = [];
  const singleByDay = new Map<string, EscAppointment[]>();

  for (const a of appointments) {
    const s = new Date(a.startAt);
    const e = new Date(a.endAt);
    // Clamp into week
    if (e < start || s > addDays(weekEnd, 1)) continue;
    const sameDay = isSameDay(s, e) || differenceInCalendarDays(e, s) === 0;
    if (sameDay) {
      // single day: attach to its day if inside week
      const d = days.find((x) => isSameDay(x, s));
      if (!d) continue;
      const key = d.toISOString();
      if (!singleByDay.has(key)) singleByDay.set(key, []);
      singleByDay.get(key)!.push(a);
    } else {
      const clampedStart = s < start ? start : s;
      const clampedEnd = e > addDays(weekEnd, 1) ? weekEnd : e;
      const colStart = Math.max(0, differenceInCalendarDays(clampedStart, start));
      const colEnd = Math.min(6, differenceInCalendarDays(clampedEnd, start));
      spans.push({
        a,
        colStart,
        colEnd,
        continuesLeft: s < start,
        continuesRight: e > addDays(weekEnd, 1),
      });
    }
  }

  // Row-pack spans so overlapping bars stack
  spans.sort((x, y) => x.colStart - y.colStart || y.colEnd - x.colEnd);
  const rows: Span[][] = [];
  for (const sp of spans) {
    const row = rows.find((r) => r[r.length - 1].colEnd < sp.colStart);
    if (row) row.push(sp); else rows.push([sp]);
  }

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

      {rows.length > 0 && (
        <div className="border-b bg-muted/10 px-1 py-1 space-y-1">
          {rows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-7 gap-1">
              {row.map((sp) => {
                const dept = deptOf(sp.a.departmentId);
                const vip = isVipTraining(sp.a);
                const tint = subtleTint(sp.a.id);
                return (
                  <button
                    key={sp.a.id}
                    type="button"
                    draggable={!!onDropAppointment}
                    onDragStart={(e) => { e.dataTransfer.setData('text/esc-id', sp.a.id); e.dataTransfer.effectAllowed = 'move'; }}
                    onClick={(e) => { e.stopPropagation(); onAppointmentClick?.(sp.a); }}
                    className={cn(
                      'text-left text-[11px] px-2 py-1 rounded-md border border-l-4 hover:brightness-110 transition truncate',
                      sp.continuesLeft && 'rounded-l-none',
                      sp.continuesRight && 'rounded-r-none',
                    )}
                    style={{
                      gridColumnStart: sp.colStart + 1,
                      gridColumnEnd: sp.colEnd + 2,
                      backgroundColor: vip ? 'hsl(142 71% 45% / 0.22)' : tint.bg,
                      borderColor: vip ? 'hsl(142 71% 45% / 0.6)' : tint.border,
                      borderLeftColor: vip ? VIP_TRAINING_COLOR : dept?.color || tint.border,
                    }}
                    title={`${sp.a.title} · ${format(new Date(sp.a.startAt), 'dd.MM. HH:mm', { locale: de })} – ${format(new Date(sp.a.endAt), 'dd.MM. HH:mm', { locale: de })}`}
                  >
                    <span className="font-medium truncate">
                      {sp.continuesLeft ? '← ' : ''}{sp.a.title}{sp.continuesRight ? ' →' : ''}
                    </span>
                    <span className="ml-1 text-muted-foreground">
                      {format(new Date(sp.a.startAt), 'dd.MM.', { locale: de })}–{format(new Date(sp.a.endAt), 'dd.MM.', { locale: de })}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-7 min-h-[420px]">
        {days.map((d) => {
          const key = d.toISOString();
          const items = (singleByDay.get(key) || []).sort((a, b) => a.startAt.localeCompare(b.startAt));
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
              {items.map((a) => {
                const tint = items.length > 1 ? subtleTint(a.id) : null;
                return (
                  <div
                    key={a.id}
                    draggable={!!onDropAppointment}
                    onDragStart={(e) => { e.dataTransfer.setData('text/esc-id', a.id); e.dataTransfer.effectAllowed = 'move'; }}
                    className="rounded-md"
                    style={tint ? { backgroundColor: tint.bg } : undefined}
                  >
                    <AppointmentCard appointment={a} department={deptOf(a.departmentId)} compact onClick={() => onAppointmentClick?.(a)} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
