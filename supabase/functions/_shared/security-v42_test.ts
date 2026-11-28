import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { PurchaseOrderSendBody, RepairQuoteSendBody } from './security-v42-input.ts';
import { ownCalendarScope } from './security-v42-scope.ts';

const id = '00000000-0000-0000-0000-000000000001';
const foreign = '00000000-0000-0000-0000-000000000002';
const names = ['plm-purchase-order-send', 'send-repair-quote', 'delivery-route-calc', 'esc-calendar-sync'];
type Handler = (request: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();
function configure() {
  Deno.env.set('SUPABASE_URL', 'https://isolated-v42.example.test');
  Deno.env.set('SUPABASE_ANON_KEY', 'public-v42');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'private-v42');
  Deno.env.set('RESEND_API_KEY', 'synthetic-resend');
  Deno.env.set('LOVABLE_API_KEY', 'synthetic-gateway');
}
async function load(name: string) {
  const cached = handlers.get(name); if (cached) return cached;
  const original = Deno.serve; let captured: Handler | undefined;
  Deno.serve = ((handler: Handler) => { captured = handler; return {}; }) as typeof Deno.serve;
  try { await import(`../${name}/index.ts`); } finally { Deno.serve = original; }
  if (!captured) throw new Error('Missing handler');
  handlers.set(name, captured); return captured;
}
const request = (token: string, body: unknown) => new Request('https://app.example.test', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
function identity(url: URL, mode = 'active'): Response | null {
  if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id, email: 'staff@example.test' });
  if (url.pathname.endsWith('/user_profiles')) return Response.json({ is_active: mode !== 'inactive', account_status: mode === 'inactive' ? 'disabled' : 'active', invitation_status: 'accepted', password_reset_required: false });
  if (url.pathname.endsWith('/user_roles')) return Response.json(mode === 'no-role' ? [] : [{ roles: { name: mode === 'unrelated' ? 'Read Only' : 'Admin' } }]);
  if (url.pathname.endsWith('/user_tenant_access')) return Response.json(mode === 'unassigned' ? [] : [{ tenant_id: id }]);
  if (url.pathname.endsWith('/tenants')) return Response.json([{ id, code: 'DE' }]);
  return null;
}
for (const name of names) {
  Deno.test(`v4.2 ${name}: public and forged credentials cannot reach business records or providers`, async () => {
    configure(); const handler = await load(name); const original = fetch; let protectedCalls = 0;
    globalThis.fetch = async input => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ message: 'invalid' }, { status: 401 });
      protectedCalls++; throw new Error('Unexpected protected access');
    };
    try {
      for (const token of ['', 'public-v42', 'private-v42', 'forged']) {
        const response = await handler(request(token, {})); assertEquals(response.status, 401); await response.body?.cancel();
      }
      assertEquals(protectedCalls, 0);
    } finally { globalThis.fetch = original; }
  });
  Deno.test(`v4.2 ${name}: inactive, roleless and unassigned accounts cannot reach business records`, async () => {
    configure(); const handler = await load(name); const original = fetch; let mode = '';
    globalThis.fetch = async input => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      assertEquals(url.hostname, 'isolated-v42.example.test');
      const response = identity(url, mode); if (response) return response;
      throw new Error('Unauthorized business access');
    };
    try {
      for (mode of ['inactive', 'no-role', 'unassigned', ...(name === 'esc-calendar-sync' ? [] : ['unrelated'])]) {
        const response = await handler(request('staff', {})); assertEquals(response.status, 403); await response.body?.cancel();
      }
    } finally { globalThis.fetch = original; }
  });
}
Deno.test('v4.2 purchase PDF validation rejects non-PDF data and malformed identifiers', () => {
  assertEquals(PurchaseOrderSendBody.safeParse({ po_id: 'invalid' }).success, false);
  assertEquals(PurchaseOrderSendBody.safeParse({ po_id: id, pdf_base64: btoa('<script>attack</script>') }).success, false);
  assertEquals(PurchaseOrderSendBody.safeParse({ po_id: id, pdf_base64: btoa('%PDF-1.7\nsynthetic') }).success, true);
  assertEquals(RepairQuoteSendBody.safeParse({ quote_id: 'invalid' }).success, false);
});
Deno.test('v4.2 calendar scope never defaults to all users or accepts another user', () => {
  assertEquals(ownCalendarScope(id), true); assertEquals(ownCalendarScope(id, id), true); assertEquals(ownCalendarScope(id, foreign), false);
});
for (const [name, body, capability] of [
  ['plm-purchase-order-send', { po_id: id }, 'plm_can_write'],
  ['send-repair-quote', { quote_id: id }, 'can_manage_repair'],
  ['delivery-route-calc', { tour_id: id }, 'can_plan_delivery'],
] as const) {
  Deno.test(`v4.2 ${name}: denied capability cannot read parent or send`, async () => {
    configure(); const handler = await load(name); const original = fetch;
    globalThis.fetch = async input => {
      const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url); if (response) return response;
      assertEquals(url.pathname, `/rest/v1/rpc/${capability}`); return Response.json(false);
    };
    try { const response = await handler(request('staff', body)); assertEquals(response.status, 403); await response.body?.cancel(); }
    finally { globalThis.fetch = original; }
  });
}
for (const [name, body, parent] of [
  ['plm-purchase-order-send', { po_id: id }, 'plm_purchase_orders'],
  ['send-repair-quote', { quote_id: id }, 'repair_quotes'],
  ['delivery-route-calc', { tour_id: id }, 'delivery_tours'],
] as const) {
  Deno.test(`v4.2 ${name}: inaccessible parent uses caller credentials and denies without writes`, async () => {
    configure(); const handler = await load(name); const original = fetch;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url); if (response) return response;
      assertEquals(url.hostname, 'isolated-v42.example.test'); assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff');
      if (url.pathname.includes('/rpc/')) return Response.json(true);
      assertEquals(init?.method ?? 'GET', 'GET'); assertEquals(url.pathname, `/rest/v1/${parent}`); return Response.json(null);
    };
    try { const response = await handler(request('staff', body)); assertEquals(response.status, 404); await response.body?.cancel(); }
    finally { globalThis.fetch = original; }
  });
}
Deno.test('v4.2 calendar foreign user rejected before credential lookup', async () => {
  configure(); const handler = await load('esc-calendar-sync'); const original = fetch;
  globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url); if (response) return response; throw new Error('Foreign calendar reached'); };
  try { const response = await handler(request('staff', { user_id: foreign })); assertEquals(response.status, 403); await response.body?.cancel(); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4.2 calendar without user_id reads only caller connections and caller-authorized tenant events', async () => {
  configure(); const handler = await load('esc-calendar-sync'); const original = fetch; let eventReads = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url); if (response) return response;
    assertEquals(url.hostname, 'isolated-v42.example.test');
    if (url.pathname.endsWith('/esc_calendar_connections')) {
      if ((init?.method ?? 'GET') === 'GET') { assertEquals(url.searchParams.get('user_id'), `eq.${id}`); return Response.json([{ id, user_id: id, provider: 'google' }]); }
      assertEquals(init?.method, 'PATCH'); return new Response(null, { status: 204 });
    }
    assertEquals(url.pathname, '/rest/v1/esc_events'); assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff');
    assertEquals(url.searchParams.get('assigned_user_id'), `eq.${id}`); assertEquals(url.searchParams.get('tenant_id'), `in.(${id})`); eventReads++;
    return Response.json([]);
  };
  try { const response = await handler(request('staff', {})); assertEquals(response.status, 200); assertEquals((await response.json()).results, []); assertEquals(eventReads, 1); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4.2 repair quote rejects a foreign company before any provider or write', async () => {
  configure(); const handler = await load('send-repair-quote'); const original = fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url); if (response) return response;
    assertEquals(url.hostname, 'isolated-v42.example.test');
    if (url.pathname.includes('/rpc/')) return Response.json(true);
    assertEquals(init?.method ?? 'GET', 'GET');
    if (url.pathname.endsWith('/repair_quotes')) return Response.json({ id, repair_order_id: id });
    assertEquals(url.pathname, '/rest/v1/repair_orders'); return Response.json({ id, tenant_id: foreign, customer_email: 'customer@example.test' });
  };
  try { const response = await handler(request('staff', { quote_id: id })); assertEquals(response.status, 403); await response.body?.cancel(); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4.2 repair provider failure does not mark the quote sent', async () => {
  configure(); const handler = await load('send-repair-quote'); const original = fetch; let providers = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url); if (response) return response;
    if (url.hostname === 'connector-gateway.lovable.dev') { providers++; return Response.json({ message: 'synthetic failure' }, { status: 503 }); }
    assertEquals(url.hostname, 'isolated-v42.example.test');
    if (url.pathname.includes('/rpc/')) return Response.json(true);
    assertEquals(init?.method ?? 'GET', 'GET');
    if (url.pathname.endsWith('/repair_quotes')) return Response.json({ id, repair_order_id: id, approval_token: 'synthetic' });
    assertEquals(url.pathname, '/rest/v1/repair_orders'); return Response.json({ id, tenant_id: id, customer_email: 'customer@example.test' });
  };
  try { const response = await handler(request('staff', { quote_id: id })); assertEquals(response.status, 502); await response.body?.cancel(); assertEquals(providers, 1); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4.2 repair successful provider dispatch writes status only with caller rights', async () => {
  configure(); const handler = await load('send-repair-quote'); const original = fetch; let writes = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url); if (response) return response;
    if (url.hostname === 'connector-gateway.lovable.dev') {
      const mail = JSON.parse(String(init?.body)); assertEquals(mail.to, ['customer@example.test']); assert(mail.html.includes('&lt;customer&gt;'));
      return Response.json({ id: 'synthetic-mail' });
    }
    assertEquals(url.hostname, 'isolated-v42.example.test'); assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff');
    if (url.pathname.includes('/rpc/')) return Response.json(true);
    if (init?.method === 'PATCH') { assertEquals(url.pathname, '/rest/v1/repair_quotes'); writes++; return Response.json({ id }); }
    if (init?.method === 'POST') { assertEquals(url.pathname, '/rest/v1/repair_quote_history'); assertEquals(JSON.parse(String(init?.body)).actor_email, 'staff@example.test'); writes++; return new Response(null, { status: 201 }); }
    if (url.pathname.endsWith('/repair_quotes')) return Response.json({ id, repair_order_id: id, approval_token: 'synthetic' });
    assertEquals(url.pathname, '/rest/v1/repair_orders'); return Response.json({ id, tenant_id: id, customer_email: 'customer@example.test', customer_name: '<customer>' });
  };
  try { const response = await handler(request('staff', { quote_id: id })); assertEquals(response.status, 200); await response.body?.cancel(); assertEquals(writes, 2); }
  finally { globalThis.fetch = original; }
});