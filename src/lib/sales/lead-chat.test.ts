import { expect, it } from 'vitest';
import { mergeChatMessages, type LeadChatMessage } from './lead-chat';
it('deduplicates stable message identities and preserves confirmed delivery status', () => {
  const m: LeadChatMessage = { id: 'a', direction: 'outbound', text: 'Hallo', at: '2026-11-03T00:00:00Z', status: 'queued', media: [] };
  expect(mergeChatMessages([m, { ...m, status: 'delivered' }])).toEqual([{ ...m, status: 'delivered' }]);
});