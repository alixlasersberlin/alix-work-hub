import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { DiscoveryRequest, DiscoveryReply, activeDiscoveryProfile, restrictDiscovery } from './discovery.ts';
const tenant = '00000000-0000-4000-8000-000000000001';
Deno.test('API discovery never accepts a client user or role', () => {
  assertEquals(DiscoveryRequest.safeParse({ action: 'list', tenant_id: tenant }).success, true);
  assertEquals(DiscoveryRequest.safeParse({ action: 'list', tenant_id: tenant, user_id: tenant }).success, false);
  assertEquals(DiscoveryRequest.safeParse({ action: 'list', tenant_id: tenant, role: 'Super Admin' }).success, false);
});
Deno.test('inactive or unapproved employees cannot discover chats', () => {
  const active = { is_active: true, account_status: 'active', invitation_status: 'accepted', password_reset_required: false };
  assertEquals(activeDiscoveryProfile(active), true);
  for (const patch of [{ is_active: false }, { account_status: 'blocked' }, { invitation_status: 'pending' }, { password_reset_required: true }]) assertEquals(activeDiscoveryProfile({ ...active, ...patch }), false);
});
Deno.test('staff never receive foreign chats even when the remote employee is mapped as admin', () => {
  const rows = [{ id: 'own', status: 'closed' }, { id: 'foreign', status: 'open' }];
  assertEquals(restrictDiscovery(rows, false, ['own']), [rows[0]]);
  assertEquals(restrictDiscovery(rows, false, []), []);
  assertEquals(restrictDiscovery(rows, true, []), rows);
});
Deno.test('discovery reply cannot contain keys or public media URLs', () => {
  const reply = { ok: true, protocol: 'alixwork-sales-v1', tenant_id: tenant, conversations: [], next_cursor: null };
  assertEquals(DiscoveryReply.safeParse(reply).success, true);
  assertEquals(DiscoveryReply.safeParse({ ...reply, api_key: 'not-a-real-key' }).success, false);
});