import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { issuePortalToken, verifyPortalToken } from './portal-session.ts';

const S = 'test-secret';
Deno.test('portal token verifies only for its order', async () => {
  const t = await issuePortalToken('order-a', 60, S);
  assertEquals(await verifyPortalToken(t, 'order-a', S), true);
  assertEquals(await verifyPortalToken(t, 'order-b', S), false);
});
Deno.test('portal token expires and rejects forgery', async () => {
  const t = await issuePortalToken('order-a', 60, S, 0);
  assertEquals(await verifyPortalToken(t, 'order-a', S, 120_000), false);
  assertEquals(await verifyPortalToken('9999999999.' + '0'.repeat(64), 'order-a', S), false);
  assertEquals(await verifyPortalToken(undefined, 'order-a', S), false);
});
