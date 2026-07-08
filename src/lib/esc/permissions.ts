// Lightweight role-based helpers for ESC.
// Uses whatever role list the caller already resolved via useAuth.
export type EscRole =
  | 'Super Admin' | 'Admin' | 'Geschäftsführung'
  | 'Order' | 'Service' | 'Vertrieb' | 'Vertriebsleitung'
  | 'Tourenplanung' | 'Finance' | 'Kundenservice' | 'SACHBEARBEITUNG' | string;

const ADMIN_LIKE: EscRole[] = ['Super Admin', 'Admin', 'Geschäftsführung'];

export function canManageDepartments(roles: string[]) {
  return roles.some((r) => ADMIN_LIKE.includes(r));
}
export function canManageEmployees(roles: string[]) {
  return roles.some((r) => ADMIN_LIKE.includes(r));
}
export function canManageResources(roles: string[]) {
  return roles.some((r) => ADMIN_LIKE.includes(r));
}
export function canCreateAppointment(roles: string[]) {
  return roles.length > 0;
}
export function canEditForeignAppointments(roles: string[]) {
  return roles.some((r) => ADMIN_LIKE.includes(r) || r === 'Tourenplanung');
}
export function canManagePublicBooking(roles: string[]) {
  return roles.some((r) => ADMIN_LIKE.includes(r));
}
export function canManageConfirmations(roles: string[]) {
  return roles.some((r) => ADMIN_LIKE.includes(r) || r === 'Kundenservice');
}
export function canViewAll(roles: string[]) {
  return roles.some((r) => ADMIN_LIKE.includes(r) || r === 'Tourenplanung' || r === 'Serviceleitung');
}
