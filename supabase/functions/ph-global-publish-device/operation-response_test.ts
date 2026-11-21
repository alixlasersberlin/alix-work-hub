import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { blockedOperation, operationStatus } from './operation-response.ts';
Deno.test('missing verified GLOBAL mapping is unsuccessful application data, never online', () => {
  assertEquals(blockedOperation(new Error('Bestätigte GLOBAL-Gerätezuordnung fehlt')), {
    ok: false, online: false, offline: false, error: 'Bestätigte GLOBAL-Gerätezuordnung fehlt',
  });
});
Deno.test('version and missing mapping conflicts do not cause HTTP runtime overlays', () => {
  assertEquals(operationStatus(409), 200);
});
Deno.test('invalid input and unauthorized requests retain transport rejection', () => {
  assertEquals(operationStatus(400), 400);
  assertEquals(operationStatus(401), 401);
  assertEquals(operationStatus(403), 403);
  assertEquals(operationStatus(503), 503);
});