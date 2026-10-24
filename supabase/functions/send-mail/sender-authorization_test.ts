import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isSenderAuthorized } from './sender-authorization.ts';
import { ORDER_SERVICE_ROLES } from './provider-sender.ts';

Deno.test('serverseitig bestätigte Admins dürfen Auftragsmail senden ohne falsche role-Spalte', async () => {
  let calls = 0;
  assertEquals(await isSenderAuthorized(true, ORDER_SERVICE_ROLES, async () => {
    calls++;
    return { data: false, error: null };
  }), true);
  assertEquals(calls, 0);
});
Deno.test('Order wird über bestehende Rollen-RPC für den externen Auftragsabsender zugelassen', async () => {
  assertEquals(await isSenderAuthorized(false, ORDER_SERVICE_ROLES, async role => ({ data: role === 'Order', error: null })), true);
});
Deno.test('Read Only erhält keine Versandberechtigung', async () => {
  assertEquals(await isSenderAuthorized(false, ORDER_SERVICE_ROLES, async role => ({ data: role === 'Read Only', error: null })), false);
});
Deno.test('fehlgeschlagene Rollenprüfung gewährt keine Berechtigung', async () => {
  assertEquals(await isSenderAuthorized(null, ORDER_SERVICE_ROLES, async () => ({ data: true, error: { message: 'RPC failed' } })), false);
});