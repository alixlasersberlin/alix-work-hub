import { describe, it, expect } from 'vitest';
import { isUnworked48h, followupState, leadVisibleTo } from './my-leads';

describe('personal lead rules', () => {
  const lead = { id: 'l', created_at: '2026-11-01T12:00:00Z', lead_status: 'Neu' };
  it('marks an unworked lead at exactly 48 hours', () => {
    expect(isUnworked48h(lead, Date.parse('2026-11-03T11:59:59Z'))).toBe(false);
    expect(isUnworked48h(lead, Date.parse('2026-11-03T12:00:00Z'))).toBe(true);
  });
  it('does not mark a genuinely worked lead', () => {
    expect(isUnworked48h({ ...lead, workspace: { last_activity_at: '2026-11-01T13:00:00Z' } }, Date.parse('2026-11-04T12:00:00Z'))).toBe(false);
  });
  it('denies another employee and revokes access on reassignment', () => {
    const assigned = { assigned_user: 'a', tenant_id: 'de' };
    expect(leadVisibleTo('a', false, assigned, ['de'])).toBe(true);
    expect(leadVisibleTo('b', false, assigned, ['de'])).toBe(false);
    expect(leadVisibleTo('a', false, { ...assigned, assigned_user: 'b' }, ['de'])).toBe(false);
  });
  it('does not give leadership a foreign lead exception', () => {
    expect(leadVisibleTo('leader', false, { assigned_user: 'employee', tenant_id: 'de' }, ['de'])).toBe(false);
  });
  it('requires a confirmed accessible tenant for non-admin staff', () => {
    expect(leadVisibleTo('a', false, { assigned_user: 'a' }, ['de'])).toBe(false);
    expect(leadVisibleTo('a', false, { assigned_user: 'a', tenant_id: 'at' }, ['de'])).toBe(false);
  });
  it('allows only the admin exception for foreign leads', () => {
    expect(leadVisibleTo('admin', true, { assigned_user: 'other' }, [])).toBe(true);
  });
  it('completed callbacks do not remain overdue', () => {
    const followup = { id: 'f', title: 'Rückruf', due_at: '2026-11-02T10:00:00Z' };
    expect(followupState(followup, new Date('2026-11-02T11:00:00Z'))).toBe('overdue');
    expect(followupState({ ...followup, done_at: '2026-11-02T10:05:00Z' }, new Date('2026-11-02T11:00:00Z'))).toBe('done');
  });
});