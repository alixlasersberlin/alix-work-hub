import type { EscAppointment, EscPriority, EscStatus } from './types';

export interface EscFilterState {
  search: string;
  departmentIds: string[];
  employeeIds: string[];
  resourceIds: string[];
  kinds: string[];
  statuses: EscStatus[];
  priorities: EscPriority[];
  locations: string[];
  customer: string;
  onlyConfirmed: boolean;
  onlyOpenConfirmation: boolean;
  onlyPublicBookings: boolean;
}

export const EMPTY_FILTER: EscFilterState = {
  search: '',
  departmentIds: [],
  employeeIds: [],
  resourceIds: [],
  kinds: [],
  statuses: [],
  priorities: [],
  locations: [],
  customer: '',
  onlyConfirmed: false,
  onlyOpenConfirmation: false,
  onlyPublicBookings: false,
};

export function activeFilterCount(f: EscFilterState): number {
  let n = 0;
  if (f.departmentIds.length) n++;
  if (f.employeeIds.length) n++;
  if (f.resourceIds.length) n++;
  if (f.kinds.length) n++;
  if (f.statuses.length) n++;
  if (f.priorities.length) n++;
  if (f.locations.length) n++;
  if (f.customer.trim()) n++;
  if (f.onlyConfirmed) n++;
  if (f.onlyOpenConfirmation) n++;
  if (f.onlyPublicBookings) n++;
  return n;
}

export function applyFilters(items: EscAppointment[], f: EscFilterState, canSeeInternal: boolean): EscAppointment[] {
  const q = f.search.trim().toLowerCase();
  const cust = f.customer.trim().toLowerCase();

  return items.filter((a) => {
    if (f.departmentIds.length && !f.departmentIds.includes(a.departmentId)) return false;
    if (f.employeeIds.length && !a.employeeIds.some((e) => f.employeeIds.includes(e))) return false;
    if (f.resourceIds.length && !(a.resourceId && f.resourceIds.includes(a.resourceId))) return false;
    if (f.kinds.length && !(a.kind && f.kinds.includes(a.kind))) return false;
    if (f.statuses.length && !f.statuses.includes(a.status)) return false;
    if (f.priorities.length && !f.priorities.includes(a.priority)) return false;
    if (f.locations.length && !(a.location && f.locations.includes(a.location))) return false;
    if (cust && !(a.customerName || '').toLowerCase().includes(cust)) return false;
    if (f.onlyConfirmed && a.status !== 'bestaetigt') return false;
    if (f.onlyOpenConfirmation && a.status !== 'bestaetigung_offen') return false;
    if (q) {
      const hay = [
        a.title, a.customerName, a.customerContact, a.customerEmail, a.customerPhone,
        a.address, a.location, a.room, a.kind, a.description, a.externalNote,
        canSeeInternal ? a.internalNote : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
