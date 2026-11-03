import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ChatEvent } from './chat-event.ts';
const event = { event: 'sales.whatsapp.message', event_id: 'test', source: 'alixsmart', version: 1, occurred_at: '2026-11-03T00:00:00Z', data: { tenant_id: '00000000-0000-4000-8000-000000000001', contact_id: 'a', conversation_id: 'b', message_id: 'm', area: 'sales', direction: 'inbound', text: 'Hallo' } };
Deno.test('chat requires sales identity and does not accept public media URLs', () => {
  assertEquals(ChatEvent.safeParse(event).success, true);
  assertEquals(ChatEvent.safeParse({ ...event, data: { ...event.data, area: 'technik' } }).success, false);
  assertEquals(ChatEvent.safeParse({ ...event, data: { ...event.data, media: [{ id: 'f', name: 'f.pdf', mime: 'application/pdf', url: 'https://public.test/f.pdf' }] } }).success, false);
});
Deno.test('empty messages are rejected and media-only messages remain possible', () => {
  assertEquals(ChatEvent.safeParse({ ...event, data: { ...event.data, text: '' } }).success, false);
  assertEquals(ChatEvent.safeParse({ ...event, data: { ...event.data, text: '', media: [{ id: 'f', name: 'f.pdf', mime: 'application/pdf' }] } }).success, true);
});
Deno.test('delivery callbacks require actual delivery status', () => {
  assertEquals(ChatEvent.safeParse({ ...event, event: 'sales.whatsapp.status' }).success, false);
  assertEquals(ChatEvent.safeParse({ ...event, event: 'sales.whatsapp.status', data: { ...event.data, status: 'delivered' } }).success, true);
});