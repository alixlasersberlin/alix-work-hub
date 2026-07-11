// Client-side tour optimization. PLZ-based nearest-neighbor.
// No external map service — uses PLZ prefix as a coarse distance proxy.

import type { EscAppointment } from '@/lib/esc/types';

export interface TourStop {
  appointment: EscAppointment;
  plz: string | null;
  order: number;
  legKm?: number; // rough estimate (100 km per PLZ-prefix diff)
}

export interface Tour {
  employeeId: string;
  date: string; // YYYY-MM-DD
  stops: TourStop[];
  totalLegKm: number;
}

const PLZ_RE = /\b(\d{4,5})\b/;

export function extractPlz(a: EscAppointment): string | null {
  const src = [a.address, a.location].filter(Boolean).join(' ');
  const m = src.match(PLZ_RE);
  return m ? m[1] : null;
}

function plzDistance(a: string | null, b: string | null): number {
  if (!a || !b) return 50;
  // Compare first 2 digits (region), then 3rd digit weight
  const diff2 = Math.abs(parseInt(a.slice(0, 2), 10) - parseInt(b.slice(0, 2), 10));
  const diff3 = Math.abs(parseInt(a.slice(0, 3), 10) - parseInt(b.slice(0, 3), 10));
  return diff2 * 40 + (diff3 % 10) * 5;
}

/** Group appointments per employee & day, return optimized tours. */
export function buildTours(appointments: EscAppointment[]): Tour[] {
  const buckets = new Map<string, EscAppointment[]>();
  for (const a of appointments) {
    if (a.status === 'storniert' || a.status === 'abgelehnt') continue;
    const day = a.startAt.slice(0, 10);
    for (const eid of a.employeeIds?.length ? a.employeeIds : ['_unassigned']) {
      const key = `${eid}::${day}`;
      buckets.set(key, [...(buckets.get(key) || []), a]);
    }
  }

  const tours: Tour[] = [];
  for (const [key, list] of buckets) {
    const [employeeId, date] = key.split('::');
    // Start with the earliest appointment as anchor.
    const sortedByTime = [...list].sort((x, y) => x.startAt.localeCompare(y.startAt));
    const remaining = [...sortedByTime];
    const stops: TourStop[] = [];
    let current = remaining.shift()!;
    stops.push({ appointment: current, plz: extractPlz(current), order: 1 });

    while (remaining.length) {
      const currentPlz = extractPlz(current);
      remaining.sort((a, b) => plzDistance(currentPlz, extractPlz(a)) - plzDistance(currentPlz, extractPlz(b)));
      const next = remaining.shift()!;
      const leg = plzDistance(currentPlz, extractPlz(next));
      stops.push({ appointment: next, plz: extractPlz(next), order: stops.length + 1, legKm: leg });
      current = next;
    }

    const totalLegKm = stops.reduce((s, x) => s + (x.legKm || 0), 0);
    tours.push({ employeeId, date, stops, totalLegKm });
  }
  return tours.sort((a, b) => a.date.localeCompare(b.date) || a.employeeId.localeCompare(b.employeeId));
}
