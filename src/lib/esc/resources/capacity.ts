// Capacity aggregation over a time range. Consumed by heatmap + dashboard.

import type { EscAppointment } from '@/lib/esc/types';
import type { RmEmployeeExt } from './types';

export interface CapacitySlot { key: string; label: string; utilization: number; }

const startOfDay = (d: Date) => { const c = new Date(d); c.setHours(0,0,0,0); return c; };

export function computeEmployeeUtilization(
  employee: RmEmployeeExt,
  appointments: EscAppointment[],
  days: Date[],
): CapacitySlot[] {
  return days.map((day) => {
    const d0 = startOfDay(day);
    const d1 = new Date(d0.getTime() + 864e5);
    const shift = employee.shifts.find((s) => s.weekday === d0.getDay());
    const capacityMin = shift
      ? diffMinutes(shift.from, shift.to)
      : 8 * 60;
    const busyMin = appointments
      .filter((a) => a.employeeIds.includes(employee.id))
      .filter((a) => new Date(a.startAt) < d1 && new Date(a.endAt) > d0)
      .reduce((sum, a) => sum + Math.max(0,
        (Math.min(new Date(a.endAt).getTime(), d1.getTime()) -
         Math.max(new Date(a.startAt).getTime(), d0.getTime())) / 60000), 0);
    return {
      key: d0.toISOString().slice(0, 10),
      label: d0.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      utilization: capacityMin ? Math.min(1.5, busyMin / capacityMin) : 0,
    };
  });
}

function diffMinutes(a: string, b: string) {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return Math.max(0, (bh * 60 + bm) - (ah * 60 + am));
}

export function utilizationColor(u: number): string {
  if (u < 0.4) return 'hsl(var(--primary) / 0.15)';
  if (u < 0.7) return 'hsl(var(--primary) / 0.35)';
  if (u < 1) return 'hsl(var(--primary) / 0.6)';
  if (u <= 1.1) return 'hsl(var(--destructive) / 0.55)';
  return 'hsl(var(--destructive) / 0.85)';
}

export function utilizationLabel(u: number): 'frei' | 'moderat' | 'hoch' | 'ueberlastet' {
  if (u < 0.4) return 'frei';
  if (u < 0.8) return 'moderat';
  if (u <= 1) return 'hoch';
  return 'ueberlastet';
}
