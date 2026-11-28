import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
const id = '00000000-0000-0000-0000-000000000001';
const foreign = '00000000-0000-0000-0000-000000000002';
const names = ['alixdocs-upload', 'return-note-send', 'ph-com-registry-push', 'security-alert-notify'];
type Handler = (req: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();
function configure() {
  Deno.env.set('SUPABASE_URL', 'https://isolated-documents-v5.example.test'); Deno.env.set('SUPABASE_ANON_KEY', 'public-docs-v5');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-docs-v5'); Deno.env.set('CRON_SECRET', 'cron-docs-v5');
  Deno.env.set('RESEND_API_KEY', 'synthetic-resend'); Deno.env.set('COM_PRODUCT_HUB_WRITE_KEY', 'synthetic-com');
}
async function load(name: string) {
  const old = handlers.get(name); if (old) return old;
  const original = Deno.serve; let captured: Handler | undefined;
  Deno.serve = ((handler: Handler) => { captured = handler; return {}; }) as typeof Deno.serve;
  try { await import(`../${name}/index.ts`); } finally { Deno.serve = original; }
  if (!captured) throw new Error(`Missing ${name}`); handlers.set(name, captured); return captured;
}
function identity(url: URL, role = 'Admin', mode = 'active'): Response | null {
  if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id, email: 'staff@example.test' });
  if (url.pathname.endsWith('/user_profiles')) return Response.json({ is_active: mode !== 'inactive', account_status: mode === 'inactive' ? 'disabled' : 'active', invitation_status: 'accepted', password_reset_required: false });
  if (url.pathname.endsWith('/user_roles')) return Response.json([{ roles: { name: role } }]);
  if (url.pathname.endsWith('/user_tenant_access')) return Response.json(mode === 'unassigned' ? [] : [{ tenant_id: id }]);
  if (url.pathname.endsWith('/tenants')) return Response.json([{ id, code: 'DE', zoho_source_system: 'zoho_eu_1' }]);
  return null;
}
const req = (token: string, body: unknown = {}) => new Request('https://app.example.test', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
function upload(body: Record<string, string> = {}) {
  const form = new FormData(); form.set('file', new File(['%PDF-1.7\nsynthetic'], 'test.pdf', { type: 'application/pdf' }));
  for (const [key, value] of Object.entries(body)) form.set(key, value);
  return new Request('https://app.example.test', { method: 'POST', headers: { Authorization: 'Bearer staff' }, body: form });
}
for (const name of names) {
  Deno.test(`v5 documents ${name}: public and forged tokens never reach records or providers`, async () => {
    configure(); const handler = await load(name); const original = fetch; let business = 0;
    globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ message: 'invalid' }, { status: 401 }); business++; throw new Error('Unauthorized records'); };
    try { for (const token of ['', 'public-docs-v5', 'forged']) { const r = await handler(req(token)); assertEquals(r.status, 401); await r.body?.cancel(); } assertEquals(business, 0); }
    finally { globalThis.fetch = original; }
  });
}
for (const name of names) {
  Deno.test(`v5 documents ${name}: inactive accounts cannot read or send`, async () => {
    configure(); const handler = await load(name); const original = fetch;
    globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); const r = identity(url, 'Super Admin', 'inactive'); if (r) return r; throw new Error('Inactive operation'); };
    try { const r = await handler(req('staff')); assertEquals(r.status, 403); await r.body?.cancel(); }
    finally { globalThis.fetch = original; }
  });
}
for (const name of ['ph-com-registry-push', 'security-alert-notify']) {
  Deno.test(`v5 ${name}: Admin cannot inherit Super Admin authority`, async () => {
    configure(); const handler = await load(name); const original = fetch;
    globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); const r = identity(url); if (r) return r; throw new Error('Inherited privileged access'); };
    try { const r = await handler(req('staff')); assertEquals(r.status, 403); await r.body?.cancel(); }
    finally { globalThis.fetch = original; }
  });
}
Deno.test('v5 COM registry remains blocked even for active Super Admin without a website call', async () => {
  configure(); const handler = await load('ph-com-registry-push'); const original = fetch; let gates = 0;
  globalThis.fetch = async (input, init) => { const url = new URL(String(input instanceof Request ? input.url : input)); assertEquals(url.hostname, 'isolated-documents-v5.example.test'); const r = identity(url, 'Super Admin'); if (r) return r; assertEquals(init?.method ?? 'GET', 'GET'); assertEquals(url.pathname, '/rest/v1/ph_settings'); gates++; return Response.json({ value: { controlled_modes: true } }); };
  try { const r = await handler(req('staff', { action: 'register' })); assertEquals(r.status, 200); assertEquals((await r.json()).ok, false); assertEquals(gates, 1); }
  finally { globalThis.fetch = original; }
});
Deno.test('v5 COM registry rejects attacker-controlled paths before data or credentialed website access', async () => {
  configure(); const handler = await load('ph-com-registry-push'); const original = fetch;
  globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); const r = identity(url, 'Super Admin'); if (r) return r; throw new Error('Unapproved registry path'); };
  try { const r = await handler(req('staff', { action: 'raw', path: '@attacker.example/test' })); assertEquals(r.status, 400); await r.body?.cancel(); }
  finally { globalThis.fetch = original; }
});
Deno.test('v5 security notification original private job handles empty findings without sending', async () => {
  configure(); const handler = await load('security-alert-notify'); const original = fetch;
  globalThis.fetch = async (input, init) => { const url = new URL(String(input instanceof Request ? input.url : input)); assertEquals(url.hostname, 'isolated-documents-v5.example.test'); assertEquals(init?.method ?? 'GET', 'GET'); assertEquals(url.pathname, '/rest/v1/security_audit_findings'); return Response.json([]); };
  try { const r = await handler(req('cron-docs-v5')); assertEquals(r.status, 200); assertEquals((await r.json()).sent, 0); }
  finally { globalThis.fetch = original; }
});
for (const mode of ['foreign-owner', 'foreign-company', 'inaccessible']) {
  Deno.test(`v5 upload rejects ${mode} before writing versions or storage`, async () => {
    configure(); const handler = await load('alixdocs-upload'); const original = fetch;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input)); const r = identity(url, mode === 'foreign-owner' ? 'Read Only' : 'Admin'); if (r) return r;
      assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff');
      if (url.pathname.endsWith('/rpc/is_internal_staff')) return Response.json(true);
      assertEquals(init?.method ?? 'GET', 'GET'); assertEquals(url.pathname, '/rest/v1/alixdocs_documents');
      return Response.json(mode === 'inaccessible' ? null : { id, current_version: 1, uploaded_by: foreign, tenant_id: mode === 'foreign-company' ? foreign : id });
    };
    try { const r = await handler(upload({ existing_document_id: id })); assertEquals(r.status, mode === 'inaccessible' ? 404 : 403); await r.body?.cancel(); }
    finally { globalThis.fetch = original; }
  });
}
Deno.test('v5 upload rejects inaccessible order parents before creating a document', async () => {
  configure(); const handler = await load('alixdocs-upload'); const original = fetch;
  globalThis.fetch = async (input, init) => { const url = new URL(String(input instanceof Request ? input.url : input)); const r = identity(url); if (r) return r; assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff'); if (url.pathname.endsWith('/rpc/is_internal_staff')) return Response.json(true); assertEquals(init?.method ?? 'GET', 'GET'); assertEquals(url.pathname, '/rest/v1/orders'); return Response.json(null); };
  try { const r = await handler(upload({ order_id: foreign })); assertEquals(r.status, 403); await r.body?.cancel(); }
  finally { globalThis.fetch = original; }
});
for (const mode of ['foreign-order', 'redirected-recipient']) {
  Deno.test(`v5 return mail rejects ${mode} without provider access`, async () => {
    configure(); const handler = await load('return-note-send'); const original = fetch;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input)); assertEquals(url.hostname, 'isolated-documents-v5.example.test'); const r = identity(url); if (r) return r;
      assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff');
      if (url.pathname.endsWith('/rpc/can_plan_delivery')) return Response.json(true);
      assertEquals(init?.method ?? 'GET', 'GET');
      if (url.pathname.endsWith('/delivery_returns')) return Response.json({ id, order_id: id });
      if (url.pathname.endsWith('/orders')) return Response.json({ id, customer_id: id, source_system: mode === 'foreign-order' ? 'zoho_eu_2' : 'zoho_eu_1' });
      assertEquals(url.pathname, '/rest/v1/customers'); return Response.json({ email: 'stored@example.test', source_system: 'zoho_eu_1' });
    };
    try { const r = await handler(req('staff', { return_id: id, email: 'redirect@example.test' })); assertEquals(r.status, 403); await r.body?.cancel(); }
    finally { globalThis.fetch = original; }
  });
}