// Minimal RFC 5545 ICS generator – compatible with Apple/iOS, Google, Outlook,
// Microsoft 365, Exchange, Thunderbird, Samsung Kalender, CalDAV import.
import type { EscAppointment } from './types';

function pad(n: number) { return n < 10 ? `0${n}` : String(n); }

function toIcsDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escapeText(s?: string): string {
  if (!s) return '';
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function buildIcsForAppointment(a: EscAppointment, opts?: { organizerEmail?: string }): string {
  const uid = `${a.id}@alixworks.de`;
  const now = toIcsDate(new Date().toISOString());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AlixWorks//Enterprise Scheduling Center//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsDate(a.startAt)}`,
    `DTEND:${toIcsDate(a.endAt)}`,
    `SUMMARY:${escapeText(a.title)}`,
    `DESCRIPTION:${escapeText(a.description || a.externalNote || '')}`,
    a.location ? `LOCATION:${escapeText(a.location)}` : '',
    a.address ? `LOCATION:${escapeText(a.address)}` : '',
    opts?.organizerEmail ? `ORGANIZER:mailto:${opts.organizerEmail}` : '',
    a.customerEmail
      ? `ATTENDEE;CN=${escapeText(a.customerName || a.customerEmail)};RSVP=TRUE:mailto:${a.customerEmail}`
      : '',
    'STATUS:CONFIRMED',
    a.reminderMinutes
      ? [
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `DESCRIPTION:${escapeText(a.title)}`,
          `TRIGGER:-PT${a.reminderMinutes}M`,
          'END:VALARM',
        ].join('\r\n')
      : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

export function downloadIcs(a: EscAppointment): void {
  const ics = buildIcsForAppointment(a);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeTitle = (a.title || 'termin').replace(/[^\w\-]+/g, '_').slice(0, 40);
  link.download = `${safeTitle}-${a.id.slice(0, 8)}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
