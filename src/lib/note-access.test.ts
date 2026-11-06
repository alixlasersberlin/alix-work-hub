import { describe, expect, it } from 'vitest';
import { canCreateNote } from './note-access';

const active = { account_status: 'active', is_active: true, invitation_status: 'accepted', password_reset_required: false };

describe('note creation without role restrictions', () => {
  it('allows active employees without requiring an administrator role', () => {
    expect(canCreateNote('employee', active, true)).toBe(true);
  });
  it('never expands access to an inaccessible record', () => {
    expect(canCreateNote('employee', active, false)).toBe(false);
  });
  it('rejects signed-out and blocked accounts', () => {
    expect(canCreateNote(undefined, active, true)).toBe(false);
    expect(canCreateNote('employee', { ...active, is_active: false }, true)).toBe(false);
    expect(canCreateNote('employee', { ...active, account_status: 'inactive' }, true)).toBe(false);
    expect(canCreateNote('employee', { ...active, invitation_status: 'pending' }, true)).toBe(false);
    expect(canCreateNote('employee', { ...active, password_reset_required: true }, true)).toBe(false);
  });
});