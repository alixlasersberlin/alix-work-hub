import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
const id = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const host = 'security-scope.example.test';
type Handler = (req: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();
async function load(name: string) {
  Deno.env.set('SUPABASE_URL', `https://${host}`); Deno.env.set('SUPABASE_ANON_KEY', 'public-scope'); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-scope'); Deno.env.set('CRON_SECRET', 'cron-scope'); Deno.env.set('COM_PRODUCT_HUB_WRITE_KEY', 'synthetic-com');
  const saved = handlers.get(name); if (saved) return saved;
  const original = Deno.serve; let h: Handler | undefined;
  Deno.serve = ((fn: Handler) => { h = fn; return {}; }) as typeof Deno.serve;
  try { await import(`../${name}/index.ts`); } finally { Deno.serve = original; }
  if (!h) throw new Error('Missing handler'); handlers.set(name, h); return h;
}
const request = (body: unknown, token = 'staff') => new Request(`https://${host}/test`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
function identity(u: URL, role = 'Admin'): Response | null {
  if (u.pathname.endsWith('/auth/v1/user')) return Response.json({ id });
  if (u.pathname.endsWith('/user_profiles')) return Response.json({ is_active: true, account_status: 'active', invitation_status: 'accepted', password_reset_required: false });
  if (u.pathname.endsWith('/user_roles')) return Response.json([{ roles: { name: role } }]);
  if (u.pathname.endsWith('/user_tenant_access')) return Response.json([{ tenant_id: id }]);
  if (u.pathname.endsWith('/tenants')) return Response.json([{ id }]);
  return null;
}
for (const name of ['ac-voice-analyze', 'ph-com-lang-push']) {
  Deno.test(`Scope ${name} rejects public or forged access before business reads or providers`, async () => {
    const h = await load(name), original = fetch; let writes = 0;
    globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); if (u.pathname.endsWith('/auth/v1/user')) return Response.json({ error: 'invalid' }, { status: 401 }); writes++; throw new Error('Unauthorized access'); };
    try { for (const t of ['', 'public-scope', 'forged']) { const r = await h(request({}, t)); assertEquals(r.status, 401); await r.body?.cancel(); } assertEquals(writes, 0); } finally { globalThis.fetch = original; }
  });
}
Deno.test('COM translation push never inherits Super Admin rights from Admin', async () => {
  const h = await load('ph-com-lang-push'), original = fetch;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r; throw new Error('Admin reached COM control'); };
  try { const r = await h(request({ action: 'probe' })); assertEquals(r.status, 403); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});
Deno.test('COM translation push retains the controlled-mode stop for authorized Super Admin', async () => {
  const h = await load('ph-com-lang-push'), original = fetch;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u, 'Super Admin'); if (r) return r; assertEquals(u.hostname, host); assert(u.pathname.endsWith('/ph_settings')); return Response.json({ value: { controlled_modes: true, enabled: false, emergency_stopped: true } }); };
  try { const r = await h(request({ action: 'batch' })); assertEquals(r.status, 200); assertEquals((await r.json()).ok, false); } finally { globalThis.fetch = original; }
});
Deno.test('COM arbitrary payload probe cannot reach the external write adapter', async () => {
  const h = await load('ph-com-lang-push'), original = fetch;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u, 'Super Admin'); if (r) return r; assert(u.pathname.endsWith('/ph_settings')); return Response.json({ value: { controlled_modes: false } }); };
  try { const r = await h(request({ action: 'probe', payload: { dry_run: false, publish: true } })); assertEquals(r.status, 403); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});
Deno.test('COM translation push checks caller product visibility before privileged text reads', async () => {
  const h = await load('ph-com-lang-push'), original = fetch;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u, 'Super Admin'); if (r) return r; if (u.pathname.endsWith('/ph_settings')) return Response.json({ value: { controlled_modes: false } }); assert(u.pathname.endsWith('/ph_products')); assertEquals(u.searchParams.get('id'), `eq.${foreign}`); return Response.json(null); };
  try { const r = await h(request({ productId: foreign, locale: 'en', dryRun: true })); assertEquals(r.status, 404); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});
Deno.test('Voice analysis cannot process a readable call attached to a foreign tenant', async () => {
  const h = await load('ac-voice-analyze'), original = fetch;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r; if (u.pathname.endsWith('/ac_voice_compliance_rules')) return Response.json([]); if (u.pathname.endsWith('/ac_calls')) return Response.json([{ id, contact_id: foreign, transcript: 'kunde: synthetische Anfrage' }]); assert(u.pathname.endsWith('/ac_contacts')); assertEquals(u.searchParams.get('tenant_id'), `in.(${id})`); return Response.json(null); };
  try { const r = await h(request({})); assertEquals(r.status, 200); assertEquals((await r.json()).processed, 0); } finally { globalThis.fetch = original; }
});
Deno.test('Voice private job preserves global scope without human impersonation', async () => {
  const h = await load('ac-voice-analyze'), original = fetch; let inserted: any;
  globalThis.fetch = async (input, init) => { const u = new URL(String(input instanceof Request ? input.url : input)); assertEquals(u.hostname, host); if (u.pathname.endsWith('/ac_voice_compliance_rules')) return Response.json([]); if (u.pathname.endsWith('/ac_calls')) return Response.json([{ id, contact_id: foreign, transcript: 'kunde: synthetische Anfrage', duration_seconds: 12 }]); assert(u.pathname.endsWith('/ac_voice_insights')); if (init?.method === 'POST') { inserted = JSON.parse(String(init.body)); return new Response(null, { status: 201 }); } assertEquals(u.searchParams.get('call_id'), `in.(${id})`); return Response.json([]); };
  try { const r = await h(request({}, 'cron-scope')); assertEquals(r.status, 200); assertEquals((await r.json()).processed, 1); assertEquals(inserted[0].call_id, id); } finally { globalThis.fetch = original; }
});