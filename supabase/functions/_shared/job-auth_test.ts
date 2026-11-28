import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { machineAuthorized, requireJobAccess } from './job-auth.ts';

Deno.test('public keys and forged service claims cannot authorize a job', () => {
  for (const key of ['public-project-key', 'eyJhbGciOiJub25lIn0.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.']) {
    const req = new Request('https://example.test', { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    assertEquals(machineAuthorized(req, 'private-cron', 'private-service'), false);
  }
});
Deno.test('empty or wrong machine credentials fail closed', () => {
  assertEquals(machineAuthorized(new Request('https://example.test'), '', ''), false);
  assertEquals(machineAuthorized(new Request('https://example.test', { headers: { 'x-cron-secret': 'wrong' } }), 'private-cron', 'private-service'), false);
});
Deno.test('existing private scheduler and internal service credentials remain valid', () => {
  const credentials: Record<string, string>[] = [{ 'x-cron-secret': 'private-cron' }, { Authorization: 'Bearer private-cron' }, { apikey: 'private-service' }];
  for (const headers of credentials) {
    assertEquals(machineAuthorized(new Request('https://example.test', { headers }), 'private-cron', 'private-service'), true);
  }
});
Deno.test('manual jobs require verified identity, active account and assigned permitted role', async () => {
  Deno.env.set('SUPABASE_URL', 'https://job-auth.example.test');
  Deno.env.set('SUPABASE_ANON_KEY', 'public-project-key');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'private-service');
  const original = globalThis.fetch;
  let active = true;
  let role = 'Admin';
  let verified = true;
  globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/auth/v1/user')) return new Response(JSON.stringify(verified ? { id: 'user-123', email: 'staff@example.test' } : { message: 'Invalid token' }), { status: verified ? 200 : 401, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/user_profiles')) return new Response(JSON.stringify({ is_active: active, account_status: active ? 'active' : 'blocked', invitation_status: 'accepted', password_reset_required: false }), { headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/user_roles')) return new Response(JSON.stringify([{ roles: { name: role } }]), { headers: { 'Content-Type': 'application/json' } });
    throw new Error('Unexpected request');
  };
  const req = new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer staff-token' } });
  try {
    assertEquals(await requireJobAccess(req, {}, ['Admin']), null);
    active = false;
    assertEquals((await requireJobAccess(req, {}, ['Admin']))?.status, 403);
    active = true; role = 'Read Only';
    assertEquals((await requireJobAccess(req, {}, ['Admin']))?.status, 403);
    verified = false;
    assertEquals((await requireJobAccess(req, {}, ['Admin']))?.status, 401);
  } finally { globalThis.fetch = original; }
});
Deno.test('public callers are rejected before database access', async () => {
  const denied = await requireJobAccess(new Request('https://example.test', { method: 'POST' }), {});
  assertEquals(denied?.status, 401);
  const method = await requireJobAccess(new Request('https://example.test'), {});
  assertEquals(method?.status, 405);
});