import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { activeMessageAccount, maySendConversation } from '../_shared/message-access.ts';

Deno.test('inactive or unaccepted account cannot send', () => {
  const active = { is_active: true, account_status: 'active', invitation_status: 'accepted', password_reset_required: false };
  assertEquals(activeMessageAccount(active), true);
  for (const patch of [{ is_active: false }, { account_status: 'inactive' }, { invitation_status: 'pending' }, { password_reset_required: true }]) {
    assertEquals(activeMessageAccount({ ...active, ...patch }), false);
  }
  assertEquals(activeMessageAccount(null), false);
});
Deno.test('non-member is denied even when staff', async () => {
  const client = { rpc: async (name: string) => ({ data: name === 'is_internal_staff', error: null }) };
  assertEquals(await maySendConversation(client, 'user', { channel_id: 'private' }), false);
});
Deno.test('member is allowed and membership binds caller and channel', async () => {
  const client = { rpc: async (name: string, args?: any) => {
    if (name === 'ac_is_channel_member') assertEquals(args, { _channel: 'private', _user: 'user' });
    return { data: true, error: null };
  } };
  assertEquals(await maySendConversation(client, 'user', { channel_id: 'private' }), true);
});
Deno.test('non-staff and failed membership checks deny delivery', async () => {
  assertEquals(await maySendConversation({ rpc: async () => ({ data: false, error: null }) }, 'user', { channel_id: null }), false);
  assertEquals(await maySendConversation({ rpc: async () => ({ data: true, error: new Error('unavailable') }) }, 'user', { channel_id: 'private' }), false);
});
Deno.test('tenant conversation requires an explicit matching assignment', async () => {
  const make = (data: unknown) => ({
    rpc: async () => ({ data: true, error: null }),
    from: (table: string) => {
      assertEquals(table, 'user_tenant_access');
      const q = { select: () => q, eq: (key: string, value: string) => {
        assertEquals(value, key === 'user_id' ? 'user' : 'tenant'); return q;
      }, maybeSingle: async () => ({ data, error: null }) }; return q;
    },
  });
  assertEquals(await maySendConversation(make(null), 'user', { channel_id: 'private', tenant_id: 'tenant' }), false);
  assertEquals(await maySendConversation(make({ tenant_id: 'tenant' }), 'user', { channel_id: 'private', tenant_id: 'tenant' }), true);
});