import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
const id = '00000000-0000-0000-0000-000000000001';
type Handler = (req: Request) => Promise<Response>;
async function load(name: string) {
  const original = Deno.serve; let captured: Handler | undefined;
  Deno.serve = ((handler: Handler) => { captured = handler; return {}; }) as typeof Deno.serve;
  try { await import(`../${name}/index.ts`); } finally { Deno.serve = original; }
  if (!captured) throw new Error('Missing handler'); return captured;
}
function configure() { Deno.env.set('SUPABASE_URL', 'https://isolated-next-v5.example.test'); Deno.env.set('SUPABASE_ANON_KEY', 'public-next-v5'); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-next-v5'); Deno.env.set('CRON_SECRET', 'cron-next-v5'); }
Deno.test('v5 inbox customer names cannot create a compound filter expression', async () => {
  configure(); const handler = await load('orders-inbox-process'); const original = fetch; let customerQueries = 0;
  const needle = 'Company),id.not.is.null,company_name.ilike.('; const source = 'synthetic';
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); assertEquals(url.hostname, 'isolated-next-v5.example.test');
    if (url.pathname.endsWith('/orders_inbox')) return (init?.method ?? 'GET') === 'GET' ? Response.json([{ id, source_system: source, external_id: 'synthetic', payload: { customer: { company_name: needle, phone: '123456789' } } }]) : new Response(null, { status: 204 });
    if (url.pathname.endsWith('/customers') && (init?.method ?? 'GET') === 'GET') {
      assertEquals(url.searchParams.has('or'), false);
      const value = url.searchParams.get('company_name') ?? url.searchParams.get('contact_name');
      assertEquals(value, `ilike.%${needle}%`); customerQueries++; return Response.json([]);
    }
    if (url.pathname.endsWith('/customers') && init?.method === 'POST') return Response.json({ message: 'synthetic insert unavailable' }, { status: 400 });
    if (url.pathname.endsWith('/orders')) return Response.json(null);
    throw new Error('Unexpected operation');
  };
  try {
    const r = await handler(new Request('https://app.example.test', { method: 'POST', headers: { Authorization: 'Bearer cron-next-v5' }, body: '{}' }));
    assertEquals(r.status, 200); await r.body?.cancel(); assertEquals(customerQueries, 2);
  } finally { globalThis.fetch = original; }
});
Deno.test('v5 human offer digest reads only tasks of tenant-authorized offers', async () => {
  configure(); const handler = await load('offer-followup-engine'); const original = fetch; let taskReads = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); assertEquals(url.hostname, 'isolated-next-v5.example.test');
    if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id });
    if (url.pathname.endsWith('/user_profiles')) return Response.json({ is_active: true, account_status: 'active', invitation_status: 'accepted', password_reset_required: false });
    if (url.pathname.endsWith('/user_roles')) return Response.json([{ roles: { name: 'Admin' } }]);
    if (url.pathname.endsWith('/user_tenant_access')) return Response.json([{ tenant_id: id }]);
    if (url.pathname.endsWith('/tenants')) return Response.json([{ id, code: 'DE' }]);
    assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff'); assertEquals(init?.method ?? 'GET', 'GET');
    if (url.pathname.endsWith('/offers')) { assertEquals(url.searchParams.get('tenant_id'), `in.(${id})`); return Response.json([]); }
    if (url.pathname.endsWith('/offer_followup_tasks')) { assertEquals(url.searchParams.get('offer_number'), 'in.()'); taskReads++; }
    return Response.json([]);
  };
  try { const r = await handler(new Request('https://app.example.test', { method: 'POST', headers: { Authorization: 'Bearer staff' }, body: '{}' })); assertEquals(r.status, 200); const body = await r.json(); assertEquals(body.notified, 0); assertEquals(taskReads, 1); assert(body.ok); }
  finally { globalThis.fetch = original; }
});