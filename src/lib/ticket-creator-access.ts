export const TICKET_CREATOR_ROLE = 'Tickets erstellen';
export const TICKET_WORKSPACE_ROLES = ['Admin', 'Super Admin', 'Kundenservice', 'Technik', 'Finance', 'Tourenplanung'];
export const TICKET_CREATION_ROLES = [...TICKET_WORKSPACE_ROLES, TICKET_CREATOR_ROLE];

export function canOpenTicketCreation(roles: readonly string[]): boolean {
  return roles.some(role => TICKET_CREATION_ROLES.includes(role));
}