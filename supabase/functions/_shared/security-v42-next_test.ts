import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
const id = '00000000-0000-0000-0000-000000000001';
const foreign = '00000000-0000-0000-0000-000000000002';
type Handler = (request: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();
function configure() {
  Deno.env.set('SUPABASE_URL', 'https://isolated-next.example.test'); Deno.env.set('SUPABASE_ANON_KEY', 'public-next'); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'private-next');
  Deno.env.set('LOVABLE_API_KEY', 'synthetic'); Deno.env.set('TWILIO_API_KEY', 'synthetic'); Deno.env.set('TWILIO_FROM_NUMBER', '+15550000000');
}
async function load(name: string) {
  const cached = handlers.get(name); if (cached) return cached;
  let captured: Handler | undefined; const original = Deno.serve;
  Deno.serve = ((handler: Handler) => { captured = handler; return {}; }) as typeof Deno.serve;
  try { await import(`../${name}/index.ts`); } finally { Deno.serve = original; }
  if (!captured) throw new Error('Missing handler'); handlers.set(name, captured); return captured;
}
const request = (data: unknown, token = 'staff') => new Request('https://app.example.test', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
function identity(url: URL, role = 'Admin', active = true, member = true): Response | null {
  if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id, email: 'staff@example.test' });
  if (url.pathname.endsWith('/user_profiles')) return Response.json({ is_active: active, account_status: active ? 'active' : 'disabled', invitation_status: 'accepted', password_reset_required: false });
  if (url.pathname.endsWith('/user_roles')) return Response.json([{ roles: { name: role } }]);
  if (url.pathname.endsWith('/user_tenant_access')) return Response.json(member ? [{ tenant_id: id }] : []);
  if (url.pathname.endsWith('/tenants')) return Response.json([{ id, zoho_source_system: 'zoho_eu_1' }]);
  return null;
}
for (const name of ['offers-ai-score', 'dispatch-eta-sms', 'rz-reminder-send']) {
  Deno.test(`v4.2 ${name}: public and forged access cannot reach records or providers`, async () => {
    configure(); const handler = await load(name); const original = fetch; let protectedCalls = 0;
    globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ message: 'invalid' }, { status: 401 }); protectedCalls++; throw new Error('Unexpected business access'); };
    try { for (const token of ['', 'public-next', 'forged']) { const response = await handler(request({}, token)); assertEquals(response.status, 401); await response.body?.cancel(); } assertEquals(protectedCalls, 0); }
    finally { globalThis.fetch = original; }
  });
  Deno.test(`v4.2 ${name}: unrelated, inactive and unassigned employees are denied`, async () => {
    configure(); const handler = await load(name); const original = fetch; let mode = 0;
    globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url, mode === 0 ? 'Read Only' : 'Admin', mode !== 1, mode !== 2); if (response) return response; throw new Error('Unexpected business access'); };
    try { for (mode = 0; mode < 3; mode++) { const response = await handler(request({})); assertEquals(response.status, 403); await response.body?.cancel(); } }
    finally { globalThis.fetch = original; }
  });
}
Deno.test('v4.2 offer scoring cannot write a model-invented foreign offer ID', async () => {
  configure(); const handler = await load('offers-ai-score'); const original = fetch; let writes = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url); if (response) return response;
    if (url.hostname === 'ai.gateway.lovable.dev') return Response.json({ choices: [{ message: { content: JSON.stringify({ results: [{ id: foreign, probability: 1 }, { id, probability: 0.75, reason: 'Synthetic' }] }) } }] });
    assertEquals(url.hostname, 'isolated-next.example.test'); assertEquals(url.pathname, '/rest/v1/offers'); assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff'); assertEquals(url.searchParams.get('tenant_id'), `in.(${id})`);
    if (init?.method === 'PATCH') { assertEquals(url.searchParams.get('id'), `eq.${id}`); assertEquals(JSON.parse(String(init?.body)).ai_probability, 0.75); writes++; return new Response(null, { status: 204 }); }
    return Response.json([{ id, tenant_id: id }]);
  };
  try { const response = await handler(request({ offer_ids: [id] })); assertEquals(response.status, 200); assertEquals((await response.json()).scored, 1); assertEquals(writes, 1); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4.2 technician cannot text another technician route customer', async () => {
  configure(); const handler = await load('dispatch-eta-sms'); const original = fetch;
  globalThis.fetch = async (input, init) => { const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url, 'Technik'); if (response) return response; assertEquals(url.pathname, '/rest/v1/route_plans'); assertEquals(init?.method ?? 'GET', 'GET'); return Response.json({ id, technician_user_id: foreign, customer_id: id }); };
  try { const response = await handler(request({ route_plan_id: id, eta_minutes: 30 })); assertEquals(response.status, 403); await response.body?.cancel(); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4.2 assigned technician cannot text a foreign-company customer', async () => {
  configure(); const handler = await load('dispatch-eta-sms'); const original = fetch;
  globalThis.fetch = async (input, init) => { const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url, 'Technik'); if (response) return response; assertEquals(init?.method ?? 'GET', 'GET'); if (url.pathname.endsWith('/route_plans')) return Response.json({ id, technician_user_id: id, customer_id: id }); assertEquals(url.pathname, '/rest/v1/customers'); return Response.json({ id, source_system: 'zoho_eu_2' }); };
  try { const response = await handler(request({ route_plan_id: id, eta_minutes: 30 })); assertEquals(response.status, 403); await response.body?.cancel(); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4.2 technician ETA sends stored contact only and logs with caller rights', async () => {
  configure(); const handler = await load('dispatch-eta-sms'); const original = fetch; let sent = 0, writes = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url, 'Technik'); if (response) return response;
    if (url.hostname === 'connector-gateway.lovable.dev') { assertEquals(new URLSearchParams(String(init?.body)).get('To'), '+15550000001'); sent++; return Response.json({ sid: 'synthetic' }); }
    assertEquals(url.hostname, 'isolated-next.example.test'); assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff');
    if (init?.method === 'PATCH' || init?.method === 'POST') { writes++; return new Response(null, { status: 204 }); }
    if (url.pathname.endsWith('/route_plans')) return Response.json({ id, technician_user_id: id, customer_id: id, contact_phone: '+15550000001' });
    if (url.pathname.endsWith('/customers')) return Response.json({ id, source_system: 'zoho_eu_1' });
    assertEquals(url.pathname, '/rest/v1/app_settings'); return Response.json(null);
  };
  try { const response = await handler(request({ route_plan_id: id, eta_minutes: 30, contact_phone: '+15559999999' })); assertEquals(response.status, 200); await response.body?.cancel(); assertEquals(sent, 1); assertEquals(writes, 2); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4.2 finance reminder preview reads only personally authorized company rows without sending', async () => {
  configure(); const handler = await load('rz-reminder-send'); const original = fetch; let reads = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url, 'Finance'); if (response) return response;
    assertEquals(url.hostname, 'isolated-next.example.test'); assertEquals(init?.method ?? 'GET', 'GET'); assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff');
    if (url.pathname.endsWith('/rz_reminder_settings')) return Response.json([]);
    assertEquals(url.pathname, '/rest/v1/rz_reminders'); assertEquals(url.searchParams.get('source_system'), 'in.(zoho_eu_1)'); reads++; return Response.json([{ id, source_system: 'zoho_eu_1', email: 'customer@example.test', currency: 'EUR' }]);
  };
  try { const response = await handler(request({ reminder_ids: [id], preview: true })); assertEquals(response.status, 200); assertEquals((await response.json()).results.length, 1); assertEquals(reads, 1); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4.2 ordinary finance cannot override reminder recipient', async () => {
  configure(); const handler = await load('rz-reminder-send'); const original = fetch;
  globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url, 'Finance'); if (response) return response; throw new Error('Unauthorized override reached records'); };
  try { const response = await handler(request({ reminder_ids: [id], override: { to_email: 'attacker@example.test' } })); assertEquals(response.status, 403); await response.body?.cancel(); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4.2 existing private reminder jobs retain preview without identity impersonation', async () => {
  configure(); const handler = await load('rz-reminder-send'); const original = fetch;
  globalThis.fetch = async (input, init) => { const url = new URL(String(input instanceof Request ? input.url : input)); assertEquals(url.hostname, 'isolated-next.example.test'); assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer private-next'); assertEquals(init?.method ?? 'GET', 'GET'); return Response.json([]); };
  try { const response = await handler(request({ reminder_ids: [id], preview: true }, 'private-next')); assertEquals(response.status, 200); assertEquals((await response.json()).results, []); }
  finally { globalThis.fetch = original; }
});