import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ChatRequest, matchesChatScope } from './contract.ts';

Deno.test('chat never accepts caller supplied conversation or tenant', () => {
  assertEquals(ChatRequest.safeParse({ action: 'read', lead_id: '00000000-0000-4000-8000-000000000001', conversation_id: 'foreign' }).success, false);
});
Deno.test('cross-tenant or cross-contact reply is rejected', () => {
  const scope = { tenant_id: 'de', contact_id: 'a', conversation_id: 'b' };
  assertEquals(matchesChatScope(scope, scope), true);
  assertEquals(matchesChatScope(scope, { ...scope, tenant_id: 'at' }), false);
  assertEquals(matchesChatScope(scope, { ...scope, contact_id: 'foreign' }), false);
  assertEquals(matchesChatScope(scope, { ...scope, conversation_id: 'foreign' }), false);
});
Deno.test('send requires bounded text and stable request identity', () => {
  const request = { action: 'send', lead_id: '00000000-0000-4000-8000-000000000001', text: 'Hallo', request_id: '00000000-0000-4000-8000-000000000002' };
  assertEquals(ChatRequest.safeParse(request).success, true);
  assertEquals(ChatRequest.safeParse({ ...request, request_id: undefined }).success, false);
  assertEquals(ChatRequest.safeParse({ ...request, text: 'x'.repeat(4001) }).success, false);
});