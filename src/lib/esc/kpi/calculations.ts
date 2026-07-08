// Presentation-layer KPI helpers over the in-memory appointment set.
// Real aggregation will happen server-side; these keep the dashboard live.

import type { EscAppointment } from '@/lib/esc/types';

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export interface EscKpiSnapshot {
  perDay: number;
  perEmployee: Record<string, number>;
  averageDurationMinutes: number;
  serviceRate: number;
  cancellationRate: number;
  noShowRate: number;
  utilization: number;
  revenuePerAppointment: number;
}

export function computeKpis(appointments: EscAppointment[], reference = new Date()): EscKpiSnapshot {
  const today = appointments.filter((a) => sameDay(new Date(a.startAt), reference));
  const durations = appointments
    .map((a) => (new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 60000)
    .filter((n) => n > 0 && n < 60 * 24);
  const avg = durations.length ? durations.reduce((s, n) => s + n, 0) / durations.length : 0;

  const perEmployee: Record<string, number> = {};
  appointments.forEach((a) => a.employeeIds?.forEach((id) => { perEmployee[id] = (perEmployee[id] || 0) + 1; }));

  const services = appointments.filter((a) => (a.kind || '').toLowerCase().includes('service'));
  const cancelled = appointments.filter((a) => a.status === 'abgesagt');
  const noshow = appointments.filter((a) => (a.status as string) === 'no_show');
  const workingMinutesPerWeek = 5 * 8 * 60;
  const utilization = Math.min(1, durations.reduce((s, n) => s + n, 0) / (Math.max(1, Object.keys(perEmployee).length) * workingMinutesPerWeek));

  return {
    perDay: today.length,
    perEmployee,
    averageDurationMinutes: Math.round(avg),
    serviceRate: appointments.length ? services.length / appointments.length : 0,
    cancellationRate: appointments.length ? cancelled.length / appointments.length : 0,
    noShowRate: appointments.length ? noshow.length / appointments.length : 0,
    utilization,
    revenuePerAppointment: 0,
  };
}
