import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
const id = '00000000-0000-0000-0000-000000000001';
const foreign = '00000000-0000-0000-0000-000000000002';
const host = 'security-final-next.example.test';
type Handler = (req: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();
function setup() {
  Deno.env.set('SUPABASE_URL', `https://${host}`); Deno.env.set('SUPABASE_ANON_KEY', 'public-next'); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-next'); Deno.env.set('CRON_SECRET', 'cron-next');
  Deno.env.set('ALIXSMART_API_BASE_URL', 'https://isolated-alixsmart.example.test'); Deno.env.set('ALIXSMART_EXPORT_URL', 'https://isolated-alixsmart.example.test/alixsmart-export-readonly'); Deno.env.set('ALIXSMART_API_PATHS', '{}'); Deno.env.set('ALIXSMART_API_KEY', 'synthetic-api'); Deno.env.set('ALIXSMART_EXPORT_KEY', 'synthetic-export'); Deno.env.set('RESEND_API_KEY', 'synthetic-resend');
}
async function load(name: string) { setup(); const saved = handlers.get(name); if (saved) return saved; const original = Deno.serve; let h: Handler | undefined; Deno.serve = ((fn: Handler) => { h = fn; return {}; }) as typeof Deno.serve; try { await import(`../${name}/index.ts`); } finally { Deno.serve = original; } if (!h) throw new Error('Handler missing'); handlers.set(name, h); return h; }
function identity(u: URL, active = true): Response | null {
  if (u.pathname.endsWith('/auth/v1/user')) return Response.json({ id, email: 'staff@example.test' });
  if (u.pathname.endsWith('/user_profiles')) return Response.json({ is_active: active, account_status: active ? 'active' : 'disabled', invitation_status: 'accepted', password_reset_required: false });
  if (u.pathname.endsWith('/user_roles')) return Response.json([{ roles: { name: 'Admin' } }]);
  if (u.pathname.endsWith('/user_tenant_access')) return Response.json([{ tenant_id: id }]);
  if (u.pathname.endsWith('/tenants')) return Response.json([{ id, zoho_source_system: 'zoho_eu_1' }]);
  return null;
}
const req = (body: unknown = {}, token = '') => new Request(`https://${host}/test`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) });
for (const name of ['cmr-portal-invite', 'alixsmart-sync-poll']) {
  Deno.test(`Final ${name}: missing, public and forged access causes no business or provider calls`, async () => {
    const handler = await load(name), original = fetch; let calls = 0;
    globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); if (u.pathname.endsWith('/auth/v1/user')) return Response.json({ message: 'invalid' }, { status: 401 }); calls++; throw new Error('Unauthorized access'); };
    try { for (const token of ['', 'public-next', 'forged']) { const r = await handler(req({ action: 'peek', table: 'profiles' }, token)); assertEquals(r.status, 401); await r.body?.cancel(); } assertEquals(calls, 0); } finally { globalThis.fetch = original; }
  });
  Deno.test(`Final ${name}: inactive administrator cannot access provider or records`, async () => {
    const handler = await load(name), original = fetch;
    globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u, false); if (r) return r; throw new Error('Inactive access'); };
    try { const r = await handler(req({}, 'staff')); assertEquals(r.status, 403); await r.body?.cancel(); } finally { globalThis.fetch = original; }
  });
}
for (const mode of ['foreign-tenant', 'revoked', 'expired', 'recipient']) {
  Deno.test(`Final CMR rejects ${mode} before sending or changing the recipient`, async () => {
    const handler = await load('cmr-portal-invite'), original = fetch;
    globalThis.fetch = async (input, init) => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r; assertEquals(u.hostname, host); assertEquals(init?.method ?? 'GET', 'GET'); assertEquals(u.pathname, '/rest/v1/cmr_portal_tokens'); assertEquals(u.searchParams.get('tenant_id'), `in.(${id})`); return Response.json({ id, tenant_id: mode === 'foreign-tenant' ? foreign : id, customer_email: 'stored@example.test', token: 'synthetic-token', is_active: mode !== 'revoked', expires_at: mode === 'expired' ? '2000-01-01T00:00:00Z' : null }); };
    try { const r = await handler(req({ tokenId: id, to: mode === 'recipient' ? 'attacker@example.test' : 'stored@example.test', portalUrl: 'https://attacker.example' }, 'staff')); assertEquals(r.status, mode === 'revoked' || mode === 'expired' ? 409 : 403); await r.body?.cancel(); } finally { globalThis.fetch = original; }
  });
}
Deno.test('Final CMR approved invite uses stored identity and trusted origin, with no recipient mutation', async () => {
  const handler = await load('cmr-portal-invite'), original = fetch; let sent: any; let businessWrites = 0;
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r;
    if (u.hostname === 'api.resend.com') { sent = JSON.parse(String(init?.body)); return Response.json({ id: 'synthetic-mail' }); }
    assertEquals(u.hostname, host); if ((init?.method ?? 'GET') !== 'GET') businessWrites++;
    if (u.pathname.endsWith('/cmr_portal_tokens')) return Response.json({ id, tenant_id: id, customer_email: 'stored@example.test', customer_name: 'Synthetic', token: 'synthetic-token', is_active: true, expires_at: null });
    if (u.pathname.endsWith('/cmr_settings')) return Response.json({ company_name: 'Synthetic', email_from_address: 'sender@example.test' });
    throw new Error('Unexpected request');
  };
  try { const r = await handler(req({ tokenId: id, to: 'STORED@example.test', portalUrl: 'javascript:malicious' }, 'staff')); assertEquals(r.status, 200); await r.body?.cancel(); assertEquals(sent.to, ['stored@example.test']); assert(sent.html.includes('https://app.alixwork.de/cmr-portal/synthetic-token')); assertEquals(sent.html.includes('javascript:'), false); assertEquals(businessWrites, 0); } finally { globalThis.fetch = original; }
});
Deno.test('Final ALIXSMART admin missing one active tenant cannot fetch a global export', async () => {
  const handler = await load('alixsmart-sync-poll'), original = fetch; let tenantReads = 0;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); if (u.pathname.endsWith('/tenants')) { tenantReads++; return Response.json(tenantReads === 1 ? [{ id }] : [{ id }, { id: foreign }]); } const r = identity(u); if (r) return r; throw new Error('Global export unauthorized'); };
  try { const r = await handler(req({ action: 'peek' }, 'staff')); assertEquals(r.status, 403); await r.body?.cancel(); assertEquals(tenantReads, 2); } finally { globalThis.fetch = original; }
});
for (const body of [{ action: 'peek', table: 'credentials' }, { action: 'unknown' }, { entities: ['unknown'] }, { full: 'true' }]) {
  Deno.test(`Final ALIXSMART rejects invalid selection ${JSON.stringify(body)} before export or writes`, async () => {
    const handler = await load('alixsmart-sync-poll'), original = fetch;
    globalThis.fetch = async () => { throw new Error('Invalid selection reached provider'); };
    try { const r = await handler(req(body, 'cron-next')); assertEquals(r.status, 400); await r.body?.cancel(); } finally { globalThis.fetch = original; }
  });
}
Deno.test('Final ALIXSMART private machine can run readonly diagnostics without business writes', async () => {
  const handler = await load('alixsmart-sync-poll'), original = fetch; let calls = 0;
  globalThis.fetch = async (input, init) => { const u = new URL(String(input instanceof Request ? input.url : input)); calls++; assertEquals(u.hostname, 'isolated-alixsmart.example.test'); assertEquals(u.searchParams.get('action'), 'export'); assertEquals(u.searchParams.get('table'), 'devices'); assertEquals(new Headers(init?.headers).get('x-alix-export-key'), 'synthetic-export'); return Response.json({ rows: [] }); };
  try { const r = await handler(req({ action: 'peek', table: 'devices' }, 'cron-next')); assertEquals(r.status, 200); assertEquals(await r.json(), { rows: [] }); assertEquals(calls, 1); } finally { globalThis.fetch = original; }
});
