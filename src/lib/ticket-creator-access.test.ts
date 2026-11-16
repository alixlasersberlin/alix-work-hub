import { describe, expect, it } from 'vitest';
import { canOpenTicketCreation, TICKET_CREATOR_ROLE, TICKET_WORKSPACE_ROLES } from './ticket-creator-access';

describe('Sanae ticket creation', () => {
  it('opens creation with her existing role plus the targeted grant', () => {
    expect(canOpenTicketCreation(['Auftragsverwaltung', TICKET_CREATOR_ROLE])).toBe(true);
  });
  it('does not open creation to other users with only her existing role', () => {
    expect(canOpenTicketCreation(['Auftragsverwaltung'])).toBe(false);
  });
  it('does not grant ticket dashboards or WhatsApp through the creation role', () => {
    expect(TICKET_WORKSPACE_ROLES.includes(TICKET_CREATOR_ROLE)).toBe(false);
  });
});