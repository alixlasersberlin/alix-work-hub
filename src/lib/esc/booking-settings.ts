// Booking settings + availability helpers for the public portal.
// Admin-tunable settings live here as defaults; later they can be loaded from esc_public_bookings settings.
import { addDays, addMinutes, isBefore, isSameDay, startOfDay } from 'date-fns';
import type { EscAppointment } from './types';

export interface BookingSettings {
  workingHours: { from: string; to: string }; // 'HH:mm'
  slotStepMinutes: number;
  bufferMinutes: number;
  advanceDaysMin: number;      // earliest bookable (e.g. 1 day)
  advanceDaysMax: number;      // latest bookable
  maxPerCustomerPerDay: number;
  workingWeekdays: number[];   // 1=Mon .. 7=Sun
  holidays: string[];          // ISO date 'YYYY-MM-DD'
  vacations: { from: string; to: string }[];
}

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  workingHours: { from: '09:00', to: '17:00' },
  slotStepMinutes: 30,
  bufferMinutes: 15,
  advanceDaysMin: 1,
  advanceDaysMax: 60,
  maxPerCustomerPerDay: 2,
  workingWeekdays: [1, 2, 3, 4, 5],
  holidays: [],
  vacations: [],
};

export interface BookingLocation {
  id: string;
  label: string;
  online: boolean;
}

export const DEFAULT_LOCATIONS: BookingLocation[] = [
  { id: 'berlin', label: 'Berlin', online: false },
  { id: 'wien', label: 'Wien', online: false },
  { id: 'dubai', label: 'Dubai', online: false },
  { id: 'miami', label: 'Miami', online: false },
  { id: 'riga', label: 'Riga', online: false },
  { id: 'online', label: 'Online-Termin', online: true },
];

function parseHM(hm: string): [number, number] {
  const [h, m] = hm.split(':').map(Number);
  return [h || 0, m || 0];
}

function isBlocked(date: Date, s: BookingSettings): boolean {
  const iso = date.toISOString().slice(0, 10);
  if (s.holidays.includes(iso)) return true;
  const wd = ((date.getDay() + 6) % 7) + 1; // 1..7 Mon..Sun
  if (!s.workingWeekdays.includes(wd)) return true;
  for (const v of s.vacations) {
    const from = new Date(v.from), to = new Date(v.to);
    if (date >= startOfDay(from) && date <= addDays(startOfDay(to), 1)) return true;
  }
  return false;
}

/** Generate available slots for a given day considering settings, existing bookings and duration. */
export function generateSlots(
  day: Date,
  durationMin: number,
  existing: Pick<EscAppointment, 'startAt' | 'endAt' | 'status'>[],
  settings: BookingSettings = DEFAULT_BOOKING_SETTINGS,
): Date[] {
  if (isBlocked(day, settings)) return [];
  const [fh, fm] = parseHM(settings.workingHours.from);
  const [th, tm] = parseHM(settings.workingHours.to);
  const dayStart = startOfDay(day);
  const now = new Date();
  const earliest = addDays(startOfDay(now), settings.advanceDaysMin);
  if (isBefore(day, earliest)) return [];
  const latest = addDays(startOfDay(now), settings.advanceDaysMax);
  if (isBefore(latest, day)) return [];

  const first = new Date(dayStart); first.setHours(fh, fm, 0, 0);
  const last = new Date(dayStart); last.setHours(th, tm, 0, 0);

  const slots: Date[] = [];
  for (let t = new Date(first); addMinutes(t, durationMin) <= last; t = addMinutes(t, settings.slotStepMinutes)) {
    const slotStart = new Date(t);
    const slotEnd = addMinutes(slotStart, durationMin);
    const conflict = existing.some((e) => {
      if (e.status === 'storniert' || e.status === 'abgelehnt') return false;
      const s = new Date(e.startAt), en = new Date(e.endAt);
      const bufferedStart = addMinutes(s, -settings.bufferMinutes);
      const bufferedEnd = addMinutes(en, settings.bufferMinutes);
      return slotStart < bufferedEnd && bufferedStart < slotEnd;
    });
    if (!conflict) slots.push(slotStart);
  }
  return slots;
}

export function nextAvailableDays(
  fromDate: Date,
  count: number,
  settings: BookingSettings = DEFAULT_BOOKING_SETTINGS,
): Date[] {
  const days: Date[] = [];
  let d = startOfDay(fromDate);
  const earliest = addDays(startOfDay(new Date()), settings.advanceDaysMin);
  if (isBefore(d, earliest)) d = earliest;
  const latest = addDays(startOfDay(new Date()), settings.advanceDaysMax);
  while (days.length < count && !isBefore(latest, d)) {
    if (!isBlocked(d, settings)) days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

export function customerBookingsToday(email: string, appointments: EscAppointment[], day: Date): number {
  return appointments.filter(
    (a) => a.customerEmail?.toLowerCase() === email.toLowerCase() && isSameDay(new Date(a.startAt), day),
  ).length;
}
