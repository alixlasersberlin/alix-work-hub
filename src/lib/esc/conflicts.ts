import type { EscAppointment } from './types';

export interface EscConflict {
  kind: 'employee' | 'resource' | 'department';
  refId: string;
  refLabel: string;
  otherAppointment: EscAppointment;
}

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
  candidate: Pick<EscAppointment, 'id' | 'startAt' | 'endAt' | 'employeeIds' | 'resourceId' | 'departmentId'>,
  all: EscAppointment[],
  opt: ConflictOptions = {},
): EscConflict[] {
  const others = all.filter((a) => a.id !== candidate.id && a.status !== 'storniert' && a.status !== 'abgelehnt');
  const conflicts: EscConflict[] = [];

  for (const o of others) {
    if (!overlaps(candidate.startAt, candidate.endAt, o.startAt, o.endAt)) continue;

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
