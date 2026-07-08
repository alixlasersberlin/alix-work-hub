// Availability & conflict engine (pure functions).
// AI dispatcher (Prompt 7) will consume the same primitives.

import type {
  RmAssignmentInput, RmConflict, RmEmployeeExt, RmVehicle, RmRoom,
  RmAbsence, RmDemoDevice,
} from './types';
import type { EscAppointment } from '@/lib/esc/types';

interface AvailabilityContext {
  appointments: EscAppointment[];
  employees: RmEmployeeExt[];
  vehicles: RmVehicle[];
  rooms: RmRoom[];
  demoDevices: RmDemoDevice[];
  absences: RmAbsence[];
}

const overlaps = (aFrom: string, aTo: string, bFrom: string, bTo: string) =>
  new Date(aFrom) < new Date(bTo) && new Date(bFrom) < new Date(aTo);

export function checkAssignment(
  input: RmAssignmentInput,
  ctx: AvailabilityContext,
): RmConflict[] {
  const conflicts: RmConflict[] = [];

  for (const empId of input.employeeIds || []) {
    const emp = ctx.employees.find((e) => e.id === empId);
    if (!emp) continue;

    // shift window
    const start = new Date(input.from);
    const shift = emp.shifts.find((s) => s.weekday === start.getDay());
    if (!shift) {
      conflicts.push({ code: 'off_hours', severity: 'warning', message: `${emp.name}: außerhalb der Arbeitszeit` });
    } else {
      const [sh, sm] = shift.from.split(':').map(Number);
      const [eh, em] = shift.to.split(':').map(Number);
      const dayStart = new Date(start); dayStart.setHours(sh, sm, 0, 0);
      const dayEnd = new Date(start); dayEnd.setHours(eh, em, 0, 0);
      if (start < dayStart || new Date(input.to) > dayEnd) {
        conflicts.push({ code: 'off_hours', severity: 'info', message: `${emp.name}: teilweise außerhalb der Schicht` });
      }
    }

    // qualifications
    for (const q of input.requiredQualifications || []) {
      if (!emp.qualifications.includes(q)) {
        conflicts.push({ code: 'qualification_missing', severity: 'error', message: `${emp.name}: Qualifikation "${q}" fehlt` });
      }
    }

    // location match
    if (input.locationId && emp.locationId && emp.locationId !== input.locationId) {
      conflicts.push({ code: 'location_mismatch', severity: 'warning', message: `${emp.name}: anderer Standort (${emp.locationId})` });
    }

    // absences
    ctx.absences
      .filter((a) => a.resourceId === empId && overlaps(a.from, a.to, input.from, input.to))
      .forEach((a) => conflicts.push({ code: 'absence', severity: 'error', message: `${emp.name}: ${a.kind}` }));

    // overlapping appointments
    ctx.appointments
      .filter((ap) => ap.employeeIds.includes(empId) && overlaps(ap.startAt, ap.endAt, input.from, input.to))
      .forEach((ap) => conflicts.push({ code: 'busy', severity: 'error', message: `${emp.name}: bereits gebucht (${ap.title})` }));
  }

  if (input.vehicleId) {
    const v = ctx.vehicles.find((x) => x.id === input.vehicleId);
    if (v?.status === 'maintenance') {
      conflicts.push({ code: 'maintenance_due', severity: 'error', message: `Fahrzeug ${v.plate} in Wartung` });
    }
    ctx.appointments
      .filter((ap) => (ap as any).vehicleId === input.vehicleId && overlaps(ap.startAt, ap.endAt, input.from, input.to))
      .forEach((ap) => conflicts.push({ code: 'busy', severity: 'error', message: `Fahrzeug bereits gebucht (${ap.title})` }));
  }

  if (input.roomId) {
    const r = ctx.rooms.find((x) => x.id === input.roomId);
    if (r?.status === 'blocked') {
      conflicts.push({ code: 'busy', severity: 'error', message: `Raum ${r.name} gesperrt` });
    }
    ctx.appointments
      .filter((ap) => ap.room === input.roomId && overlaps(ap.startAt, ap.endAt, input.from, input.to))
      .forEach((ap) => conflicts.push({ code: 'busy', severity: 'error', message: `Raum belegt (${ap.title})` }));
  }

  if (input.demoDeviceId) {
    const d = ctx.demoDevices.find((x) => x.id === input.demoDeviceId);
    if (d && d.status !== 'available' && d.status !== 'reserved') {
      conflicts.push({ code: 'busy', severity: 'warning', message: `${d.name}: ${d.status}` });
    }
    ctx.appointments
      .filter((ap) => ap.deviceId === input.demoDeviceId && overlaps(ap.startAt, ap.endAt, input.from, input.to))
      .forEach((ap) => conflicts.push({ code: 'busy', severity: 'error', message: `Vorführgerät belegt (${ap.title})` }));
  }

  return conflicts;
}

export function suggestBestEmployees(
  input: RmAssignmentInput,
  ctx: AvailabilityContext,
): { employee: RmEmployeeExt; conflicts: RmConflict[]; score: number }[] {
  return ctx.employees
    .filter((e) => e.active)
    .map((employee) => {
      const c = checkAssignment({ ...input, employeeIds: [employee.id] }, ctx);
      const errors = c.filter((x) => x.severity === 'error').length;
      const warnings = c.filter((x) => x.severity === 'warning').length;
      const qualHit = (input.requiredQualifications || []).every((q) => employee.qualifications.includes(q));
      const locHit = !input.locationId || employee.locationId === input.locationId;
      const score = (qualHit ? 40 : 0) + (locHit ? 20 : 0) + Math.max(0, 40 - errors * 20 - warnings * 5);
      return { employee, conflicts: c, score };
    })
    .sort((a, b) => b.score - a.score);
}
