import { describe, it, expect } from 'vitest';
import { defaultWhatsAppTenant, filterLiveSessions, type LiveSession } from './live-sessions';
const closed: LiveSession = { id: 'closed-session', contact_id: 'contact', status: 'closed', triage_state: 'released', assigned_user_id: null, last_message_at: null };
describe('live ALIXSMART sessions', () => {
  it('defaults to Alix Germany only when available to the user', () => {
    const tenants = [{ id: 'austria', code: 'AT' }, { id: 'germany', code: 'DE' }];
    expect(defaultWhatsAppTenant(tenants, 'austria')).toBe('germany');
    expect(defaultWhatsAppTenant([tenants[0]], 'austria')).toBe('austria');
    expect(defaultWhatsAppTenant([], 'germany')).toBe('');
  });
  it('includes closed sessions without inferring a lead outcome', () => {
    expect(filterLiveSessions([closed], '', '')).toEqual([closed]);
    expect(filterLiveSessions([closed], 'closed', '')).toEqual([closed]);
    expect(filterLiveSessions([closed], 'open', '')).toEqual([]);
  });
});