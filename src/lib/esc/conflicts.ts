import type { EscAppointment } from './types';

export interface EscConflict {
  kind: 'employee' | 'resource' | 'department' | 'duplicate';
  refId: string;
  refLabel: string;
  otherAppointment: EscAppointment;
}

const norm = (v?: string) => (v || '').trim().toLowerCase();

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

export interface ConflictOptions {
  employees?: { id: string; name: string }[];
  resources?: { id: string; name: string }[];
  departments?: { id: string; name: string }[];
}

/** Find all conflicts for the given (possibly draft) appointment. */
export function findConflicts(
  candidate: Pick<EscAppointment, 'id' | 'startAt' | 'endAt' | 'employeeIds' | 'resourceId' | 'departmentId'> &
    Partial<Pick<EscAppointment, 'title' | 'customerName' | 'customerEmail'>>,
  all: EscAppointment[],
  opt: ConflictOptions = {},
): EscConflict[] {
  const others = all.filter((a) => a.id !== candidate.id && a.status !== 'storniert' && a.status !== 'abgelehnt');
  const conflicts: EscConflict[] = [];

  for (const o of others) {
    if (!overlaps(candidate.startAt, candidate.endAt, o.startAt, o.endAt)) continue;

    // Doppeltermin: gleicher Kunde ODER identischer Titel im selben Zeitfenster
    const sameCustomer =
      (!!norm(candidate.customerEmail) && norm(candidate.customerEmail) === norm(o.customerEmail)) ||
      (!!norm(candidate.customerName) && norm(candidate.customerName) === norm(o.customerName));
    const sameTitle = !!norm(candidate.title) && norm(candidate.title) === norm(o.title);
    if (sameCustomer || sameTitle) {
      conflicts.push({
        kind: 'duplicate',
        refId: o.id,
        refLabel: candidate.customerName || candidate.title || 'Termin',
        otherAppointment: o,
      });
    }

    // Employee conflicts
    for (const eid of candidate.employeeIds || []) {
      if ((o.employeeIds || []).includes(eid)) {
        conflicts.push({
          kind: 'employee',
          refId: eid,
          refLabel: opt.employees?.find((x) => x.id === eid)?.name || eid,
          otherAppointment: o,
        });
      }
    }

    // Resource conflict
    if (candidate.resourceId && o.resourceId === candidate.resourceId) {
      conflicts.push({
        kind: 'resource',
        refId: candidate.resourceId,
        refLabel: opt.resources?.find((x) => x.id === candidate.resourceId)?.name || candidate.resourceId,
        otherAppointment: o,
      });
    }
  }
  return conflicts;
}
