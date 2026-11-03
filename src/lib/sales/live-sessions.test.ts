import { describe, it, expect } from 'vitest';
import { filterLiveSessions, type LiveSession } from './live-sessions';
const closed: LiveSession = { id: 'closed-session', contact_id: 'contact', status: 'closed', triage_state: 'released', assigned_user_id: null, last_message_at: null };
describe('live ALIXSMART sessions', () => {
  it('includes closed sessions without inferring a lead outcome', () => {
    expect(filterLiveSessions([closed], '', '')).toEqual([closed]);
    expect(filterLiveSessions([closed], 'closed', '')).toEqual([closed]);
    expect(filterLiveSessions([closed], 'open', '')).toEqual([]);
  });
});