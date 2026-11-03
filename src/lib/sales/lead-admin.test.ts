import { describe, it, expect } from 'vitest';
import { canReassignLeads, leadInWorkspace, isWhatsAppLead, matchesSessionStatus, matchesLeadUser, leadAssignmentOptions } from './lead-admin';
const lead = { id: 'lead', created_at: '2026-11-03', lead_status: 'Neu', assigned_user: 'other', tenant_id: 'at' };
describe('Super Admin lead workspace', () => {
  it('lists all users while preserving the server-approved assignment boundary', () => {
    const options = leadAssignmentOptions([
      { id: 'approved', full_name: 'Jerry', is_active: true },
      { id: 'foreign', full_name: 'Huong', is_active: true },
      { id: 'inactive', full_name: 'Natalia', is_active: false },
    ], [{ id: 'approved', name: 'Jerry' }, { id: 'inactive', name: 'Natalia' }]);
    expect(options.map(p => p.id)).toEqual(['foreign', 'approved', 'inactive']);
    expect(options.find(p => p.id === 'approved')?.disabled).toBe(false);
    expect(options.find(p => p.id === 'foreign')?.disabled).toBe(true);
    expect(options.find(p => p.id === 'inactive')?.disabled).toBe(true);
  });
  it('filters by any selected user or unassigned without hiding users with no matching leads', () => {
    expect(matchesLeadUser(lead, '')).toBe(true);
    expect(matchesLeadUser(lead, 'other')).toBe(true);
    expect(matchesLeadUser(lead, 'another')).toBe(false);
    expect(matchesLeadUser(lead, 'unassigned')).toBe(false);
    expect(matchesLeadUser({ ...lead, assigned_user: undefined }, 'unassigned')).toBe(true);
  });
  it('allows reassignment only for the explicit Super Admin role', () => {
    expect(canReassignLeads(['Super Admin'])).toBe(true);
    for (const role of ['Admin', 'Vertrieb', 'Vertriebsleitung', 'Geschäftsführung']) expect(canReassignLeads([role])).toBe(false);
  });
  it('shows all assigned and incoming leads across tenant filters in the administrator overview', () => {
    expect(leadInWorkspace(lead, 'super', true, true, 'de')).toBe(true);
    expect(leadInWorkspace({ ...lead, assigned_user: undefined, tenant_id: undefined }, 'super', true, true, 'de')).toBe(true);
  });
  it('does not let staff enable a foreign lead overview', () => {
    expect(leadInWorkspace(lead, 'employee', false, true, 'de')).toBe(false);
    expect(leadInWorkspace(lead, 'other', false, true, 'at')).toBe(true);
  });
  it('includes closed WhatsApp sessions in the unfiltered overview', () => {
    const closed = { ...lead, source: 'form', lead_status: 'Archiviert', whatsapp_session: { linked: true, status: 'closed' } };
    expect(isWhatsAppLead(closed)).toBe(true);
    expect(matchesSessionStatus(closed, '')).toBe(true);
    expect(matchesSessionStatus(closed, 'closed')).toBe(true);
    expect(matchesSessionStatus(closed, 'open')).toBe(false);
    expect(leadInWorkspace(closed, 'super', true, true, 'de')).toBe(true);
    expect(leadInWorkspace(closed, 'employee', false, true, 'de')).toBe(false);
  });
  it('filters every conversation status without equating lead outcomes with closed sessions', () => {
    for (const status of ['open', 'pending', 'resolved', 'closed', 'snoozed', 'custom']) {
      const session = { ...lead, whatsapp_session: { linked: true, status } };
      expect(matchesSessionStatus(session, '')).toBe(true);
      expect(matchesSessionStatus(session, status)).toBe(true);
      expect(matchesSessionStatus(session, 'unknown')).toBe(false);
    }
    expect(matchesSessionStatus({ ...lead, lead_status: 'Gewonnen' }, 'closed')).toBe(false);
    expect(matchesSessionStatus(lead, 'unknown')).toBe(true);
  });
});