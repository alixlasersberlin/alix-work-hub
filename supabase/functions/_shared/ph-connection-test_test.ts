import { assertEquals } from 'jsr:@std/assert@1';
import { evaluateConnectionTest as e } from './ph-connection-test.ts';
Deno.test('405 alone is reachable, never authenticated', () => {
  const r = e({ status: 405 }, { status: 401 }, { status: 400 }, false);
  assertEquals([r.reachable, r.auth_required, r.signature, r.result], [true, true, 'unsupported', 'auth_required']);
});
Deno.test('unsigned accepted is a security failure', () => assertEquals(e({ status: 405 }, { status: 202 }, { status: 202 }, true).result, 'error'));
Deno.test('wrong key', () => assertEquals(e({ status: 405 }, { status: 401 }, { status: 401 }, false).signature, 'rejected'));
Deno.test('signature without receipt', () => assertEquals(e({ status: 405 }, { status: 401 }, { status: 202 }, false).result, 'signature_ok'));
Deno.test('full acceptance', () => assertEquals(e({ status: 405 }, { status: 401 }, { status: 202 }, true).result, 'accepted'));
Deno.test('unreachable', () => assertEquals(e({ status: null }, { status: null }, { status: null }, false).result, 'error'));
