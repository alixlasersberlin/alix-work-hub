import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { signState, verifyState } from './signed-state.ts';
const U = '7110c16c-0000-4000-8000-000000000000';
Deno.test('signed state returns subject only when authentic', async () => {
  const s = await signState('oauth', U, 600, 'k');
  assertEquals(await verifyState('oauth', s, 'k'), U);
  assertEquals(await verifyState('other', s, 'k'), null);
  assertEquals(await verifyState('oauth', U, 'k'), null);
  assertEquals(await verifyState('oauth', s.replace(U, '00000000-0000-4000-8000-000000000000'), 'k'), null);
});
Deno.test('signed state expires', async () => {
  const s = await signState('oauth', U, 60, 'k', 0);
  assertEquals(await verifyState('oauth', s, 'k', 120_000), null);
});
