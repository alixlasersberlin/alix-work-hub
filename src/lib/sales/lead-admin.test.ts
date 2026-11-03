import { describe, it, expect } from 'vitest';
import { canReassignLeads, leadInWorkspace } from './lead-admin';
const lead = { id: 'lead', created_at: '2026-11-03', lead_status: 'Neu', assigned_user: 'other', tenant_id: 'at' };
describe('Super Admin lead workspace', () => {
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
});