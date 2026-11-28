import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { assignedRoleAllowed, requireCallerAccess } from './caller-access.ts';
import { getTenantScope, sourceInScope, tenantInScope } from './tenant-scope.ts';

const cors = {};
const req = () => new Request('https://app.example.test', { headers: { Authorization: 'Bearer staff-session' } });

Deno.test('normal administrators never inherit Super Admin authorization', () => {
  assertEquals(assignedRoleAllowed(['Admin'], ['Super Admin']), false);
  assertEquals(assignedRoleAllowed(['Super Admin'], ['Super Admin']), true);
});

Deno.test('active assigned staff retain two explicitly assigned companies', async () => {
  Deno.env.set('SUPABASE_URL', 'https://caller.example.test');
  Deno.env.set('SUPABASE_ANON_KEY', 'public-key');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'private-service');
  const original = globalThis.fetch;
  let active = true, assigned = true, verified = true;
  let role = 'Finance';
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input); calls.push(url);
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/auth/v1/user')) return json(verified ? { id: 'staff-id' } : { message: 'invalid' }, verified ? 200 : 401);
    if (url.includes('/user_profiles')) return json({ is_active: active, account_status: active ? 'active' : 'disabled', invitation_status: 'accepted', password_reset_required: false });
    if (url.includes('/user_roles')) return json([{ roles: { name: role } }]);
    if (url.includes('/user_tenant_access')) return json(assigned ? [{ tenant_id: 'de-id' }, { tenant_id: 'at-id' }] : []);
    if (url.includes('/tenants')) return json([{ id: 'de-id', code: 'DE', zoho_source_system: 'zoho_eu_1' }, { id: 'at-id', code: 'AT', zoho_source_system: 'zoho_eu_2' }]);
    throw new Error('Unauthorized business read in access helper');
  };
  try {
    const allowed = await requireCallerAccess(req(), cors, ['Finance']);
    assertEquals('caller' in allowed, true);
    const scope = await getTenantScope(req());
    assertEquals(scope.tenantIds, ['de-id', 'at-id']);
    assertEquals(sourceInScope(scope, 'zoho_eu_1'), true);
    assertEquals(sourceInScope(scope, 'zoho_eu_2'), true);
    assertEquals(tenantInScope(scope, 'foreign-id'), false);
    assertEquals(tenantInScope(scope, null), false);
    assigned = false;
    assertEquals((await requireCallerAccess(req(), cors) as any).response.status, 403);
    assertEquals(sourceInScope(await getTenantScope(req()), 'zoho_eu_1'), false);
    assigned = true; active = false;
    assertEquals((await requireCallerAccess(req(), cors) as any).response.status, 403);
    active = true; role = 'Admin';
    assertEquals((await requireCallerAccess(req(), cors, ['Super Admin']) as any).response.status, 403);
    verified = false; calls.length = 0;
    assertEquals((await requireCallerAccess(req(), cors) as any).response.status, 401);
    assertEquals(calls.length, 1);
  } finally { globalThis.fetch = original; }
});

Deno.test('missing identity fails before database reads', async () => {
  assertEquals((await requireCallerAccess(new Request('https://example.test'), cors) as any).response.status, 401);
});

Deno.test('tenant-scoped workers preserve the existing private cron identity', async () => {
  Deno.env.set('CRON_SECRET', 'tenant-fixture-cron');
  const scope = await getTenantScope(new Request('https://example.test', { headers: { 'x-cron-secret': 'tenant-fixture-cron' } }));
  assertEquals(scope.serviceRole, true);
  assertEquals(sourceInScope(scope, 'zoho_eu_1'), true);
  assertEquals(sourceInScope(scope, 'zoho_eu_2'), true);
});