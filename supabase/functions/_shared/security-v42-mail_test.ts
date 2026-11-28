import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { approvedCatalogBase, catalogShareOwned, sameMailRecipient } from './security-v42-mail.ts';
const id = '00000000-0000-0000-0000-000000000001';
const foreign = '00000000-0000-0000-0000-000000000002';
type Handler = (request: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();
function configure() {
  Deno.env.set('SUPABASE_URL', 'https://isolated-v42-mail.example.test');
  Deno.env.set('SUPABASE_ANON_KEY', 'public-v42-mail'); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'private-v42-mail');
  Deno.env.set('RESEND_API_KEY', 'synthetic'); Deno.env.set('LOVABLE_API_KEY', 'synthetic');
  Deno.env.set('TWILIO_ACCOUNT_SID', 'synthetic'); Deno.env.set('TWILIO_AUTH_TOKEN', 'synthetic'); Deno.env.set('TWILIO_SMS_FROM_NUMBER', '+15550000000');
}
async function load(name: string) {
  const cached = handlers.get(name); if (cached) return cached;
  let captured: Handler | undefined; const original = Deno.serve;
  Deno.serve = ((handler: Handler) => { captured = handler; return {}; }) as typeof Deno.serve;
  try { await import(`../${name}/index.ts`); } finally { Deno.serve = original; }
  if (!captured) throw new Error('Missing handler'); handlers.set(name, captured); return captured;
}
const request = (body: unknown, token = 'staff') => new Request('https://app.example.test', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
function identity(url: URL, role = 'Admin'): Response | null {
  if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id });
  if (url.pathname.endsWith('/user_profiles')) return Response.json({ is_active: true, account_status: 'active', invitation_status: 'accepted', password_reset_required: false });
  if (url.pathname.endsWith('/user_roles')) return Response.json([{ roles: { name: role } }]);
  if (url.pathname.endsWith('/user_tenant_access')) return Response.json([{ tenant_id: id }]);
  if (url.pathname.endsWith('/tenants')) return Response.json([{ id, code: 'DE', zoho_source_system: 'zoho_eu_1' }]);
  return null;
}
for (const name of ['send-order-confirmation', 'catalog-share-send', 'convert-signed-offer-to-order']) {
  Deno.test(`v4.2 ${name}: anonymous, project key and forged identity never reach records`, async () => {
    configure(); const handler = await load(name); const original = fetch; let business = 0;
    globalThis.fetch = async input => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ message: 'invalid' }, { status: 401 });
      business++; throw new Error('Unexpected business access');
    };
    try {
      for (const token of ['', 'public-v42-mail', 'private-v42-mail', 'forged']) { const response = await handler(request({}, token)); assertEquals(response.status, 401); await response.body?.cancel(); }
      assertEquals(business, 0);
    } finally { globalThis.fetch = original; }
  });
  Deno.test(`v4.2 ${name}: unrelated read-only role cannot perform business action`, async () => {
    configure(); const handler = await load(name); const original = fetch;
    globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url, 'Read Only'); if (response) return response; throw new Error('Unexpected business access'); };
    try { const response = await handler(request({})); assertEquals(response.status, 403); await response.body?.cancel(); }
    finally { globalThis.fetch = original; }
  });
}
Deno.test('v4.2 recipient identity cannot be redirected to an arbitrary external address', () => {
  assertEquals(sameMailRecipient('attacker@example.test', 'customer@example.test'), false);
  assertEquals(sameMailRecipient('CUSTOMER@example.test', 'customer@example.test'), true);
  assertEquals(sameMailRecipient(undefined, undefined), false);
});
Deno.test('v4.2 sales share ownership does not inherit privileged catalog rights', () => {
  assertEquals(catalogShareOwned(id, foreign, ['Vertrieb']), false);
  assertEquals(catalogShareOwned(id, id, ['Vertrieb']), true);
  assertEquals(catalogShareOwned(id, foreign, ['Katalog']), true);
});
Deno.test('v4.2 catalog URLs reject untrusted hosts, credentials and query parameters', () => {
  assertEquals(approvedCatalogBase('https://attacker.example.test/catalog/share/'), null);
  assertEquals(approvedCatalogBase('https://user:pass@alixwork.de/catalog/share/'), null);
  assertEquals(approvedCatalogBase('https://alixwork.de/catalog/share/?redirect=evil'), null);
  assertEquals(approvedCatalogBase('https://app.alixwork.de/catalog/share/'), 'https://app.alixwork.de/catalog/share/');
});
for (const [name, body, table] of [
  ['send-order-confirmation', { order_id: id }, 'orders'],
  ['send-order-confirmation', { signature_id: id }, 'alix_sign_signatures'],
  ['convert-signed-offer-to-order', { offer_number: 'ANG-2026-04691' }, 'alix_sign_requests'],
] as const) {
  Deno.test(`v4.2 ${name} ${table}: inaccessible parent is read through caller without writes`, async () => {
    configure(); const handler = await load(name); const original = fetch;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url); if (response) return response;
      assertEquals(url.hostname, 'isolated-v42-mail.example.test'); assertEquals(url.pathname, `/rest/v1/${table}`);
      assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff'); assertEquals(init?.method ?? 'GET', 'GET'); return Response.json(null);
    };
    try { const response = await handler(request(body)); assertEquals(response.status, 404); await response.body?.cancel(); }
    finally { globalThis.fetch = original; }
  });
}
Deno.test('v4.2 catalog sales user cannot dispatch another sales user link', async () => {
  configure(); const handler = await load('catalog-share-send'); const original = fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url, 'Vertrieb'); if (response) return response;
    assertEquals(url.pathname, '/rest/v1/catalog_share_links'); assertEquals(init?.method ?? 'GET', 'GET'); return Response.json({ id, created_by: foreign, item_id: id });
  };
  try { const response = await handler(request({ link_id: id, channel: 'sms' })); assertEquals(response.status, 403); await response.body?.cancel(); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4.2 catalog authorized SMS uses only stored recipient and caller-scoped item', async () => {
  configure(); const handler = await load('catalog-share-send'); const original = fetch; let sent = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url, 'Vertrieb'); if (response) return response;
    if (url.hostname === 'api.twilio.com') { const form = new URLSearchParams(String(init?.body)); assertEquals(form.get('To'), '+15550000001'); sent++; return Response.json({ sid: 'synthetic' }); }
    assertEquals(url.hostname, 'isolated-v42-mail.example.test'); assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff');
    if (init?.method === 'PATCH' || init?.method === 'POST') return new Response(null, { status: 204 });
    if (url.pathname.endsWith('/catalog_share_links')) return Response.json({ id, created_by: id, item_id: id, token: 'synthetic', recipient_phone: '+15550000001' });
    assertEquals(url.pathname, '/rest/v1/catalog_items'); return Response.json({ id, name: 'Synthetic item', source_system: 'zoho_eu_1' });
  };
  try { const response = await handler(request({ link_id: id, channel: 'sms', recipient_phone: '+15559999999' })); assertEquals(response.status, 200); await response.body?.cancel(); assertEquals(sent, 1); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4.2 order confirmation rejects cross-company order before signing or provider use', async () => {
  configure(); const handler = await load('send-order-confirmation'); const original = fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url); if (response) return response;
    assertEquals(url.hostname, 'isolated-v42-mail.example.test'); assertEquals(url.pathname, '/rest/v1/orders'); assertEquals(init?.method ?? 'GET', 'GET'); return Response.json({ id, source_system: 'zoho_eu_2' });
  };
  try { const response = await handler(request({ order_id: id })); assertEquals(response.status, 403); await response.body?.cancel(); }
  finally { globalThis.fetch = original; }
});