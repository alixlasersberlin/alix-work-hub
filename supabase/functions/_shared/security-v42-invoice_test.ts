import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { approvedInvoiceCopies, InvoiceMailBody } from './security-v42-invoice.ts';
const id = '00000000-0000-0000-0000-000000000001';
type Handler = (request: Request) => Promise<Response>;
let handler: Handler | undefined;
async function load() {
  if (handler) return handler;
  Deno.env.set('SUPABASE_URL', 'https://isolated-invoice.example.test'); Deno.env.set('SUPABASE_ANON_KEY', 'public-invoice'); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'private-invoice'); Deno.env.set('LOVABLE_API_KEY', 'synthetic'); Deno.env.set('RESEND_API_KEY', 'synthetic');
  const original = Deno.serve;
  Deno.serve = ((captured: Handler) => { handler = captured; return {}; }) as typeof Deno.serve;
  try { await import('../send-invoice-mail/index.ts'); } finally { Deno.serve = original; }
  if (!handler) throw new Error('Missing handler'); return handler;
}
function identity(url: URL, role = 'Finance'): Response | null {
  if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id });
  if (url.pathname.endsWith('/user_profiles')) return Response.json({ is_active: true, account_status: 'active', invitation_status: 'accepted', password_reset_required: false });
  if (url.pathname.endsWith('/user_roles')) return Response.json([{ roles: { name: role } }]);
  if (url.pathname.endsWith('/user_tenant_access')) return Response.json([{ tenant_id: id }]);
  if (url.pathname.endsWith('/tenants')) return Response.json([{ id, zoho_source_system: 'zoho_eu_1' }]);
  return null;
}
const body = { to_email: 'customer@example.test', subject: 'Synthetic invoice', body_text: 'Synthetic test only', attachments: [{ filename: 'synthetic.pdf', content: btoa('%PDF-1.7\nsynthetic'), contentType: 'application/pdf' }] };
const request = (data: unknown = body, token = 'staff') => new Request('https://app.example.test', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
Deno.test('v4.2 invoice mail rejects forged and public credentials before provider or records', async () => {
  const invoke = await load(); const original = fetch; let business = 0;
  globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ message: 'invalid' }, { status: 401 }); business++; throw new Error('Unexpected business access'); };
  try { for (const token of ['', 'public-invoice', 'forged']) { const response = await invoke(request(body, token)); assertEquals(response.status, 401); await response.body?.cancel(); } assertEquals(business, 0); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4.2 invoice mail denies an unrelated active role', async () => {
  const invoke = await load(); const original = fetch;
  globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url, 'Read Only'); if (response) return response; throw new Error('Unexpected business access'); };
  try { const response = await invoke(request()); assertEquals(response.status, 403); await response.body?.cancel(); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4.2 invoice mail denies an inaccessible recipient through caller-scoped company query', async () => {
  const invoke = await load(); const original = fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url); if (response) return response;
    assertEquals(url.hostname, 'isolated-invoice.example.test'); assertEquals(url.pathname, '/rest/v1/customers'); assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff'); assertEquals(url.searchParams.get('email'), 'eq.customer@example.test'); assertEquals(url.searchParams.get('source_system'), 'in.(zoho_eu_1)');
    return Response.json([]);
  };
  try { const response = await invoke(request()); assertEquals(response.status, 403); await response.body?.cancel(); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4.2 invoice mail denies arbitrary external copies even for finance staff', () => {
  assertEquals(approvedInvoiceCopies(['attacker@example.test']), false); assertEquals(approvedInvoiceCopies(['k.trinh@alix-operation.de']), true);
});
Deno.test('v4.2 invoice attachments and mail headers reject malformed data', () => {
  assertEquals(InvoiceMailBody.safeParse({ ...body, subject: 'invoice\nBcc: attacker@example.test' }).success, false);
  assertEquals(InvoiceMailBody.safeParse({ ...body, attachments: [{ filename: '../evil.pdf', content: 'abcd' }] }).success, false);
  assertEquals(InvoiceMailBody.safeParse({ ...body, attachments: [{ filename: 'file.pdf', content: '*not-base64' }] }).success, false);
});
Deno.test('v4.2 authorized invoice mail dispatch preserves stored customer and attachment without retries', async () => {
  const invoke = await load(); const original = fetch; let sends = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); const response = identity(url); if (response) return response;
    if (url.hostname === 'connector-gateway.lovable.dev') { const mail = JSON.parse(String(init?.body)); assertEquals(mail.to, ['customer@example.test']); assertEquals(mail.attachments[0].content, body.attachments[0].content); sends++; return Response.json({ id: 'synthetic-only' }); }
    assertEquals(url.hostname, 'isolated-invoice.example.test'); assertEquals(url.pathname, '/rest/v1/customers'); return Response.json([{ id }]);
  };
  try { const response = await invoke(request()); assertEquals(response.status, 200); await response.body?.cancel(); assertEquals(sends, 1); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4.2 existing private invoice jobs retain trusted dispatch without human impersonation', async () => {
  const invoke = await load(); const original = fetch; let sends = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    assertEquals(url.hostname, 'connector-gateway.lovable.dev');
    const mail = JSON.parse(String(init?.body)); assertEquals(mail.to, ['customer@example.test']); sends++; return Response.json({ id: 'synthetic-private-job' });
  };
  try { const response = await invoke(request(body, 'private-invoice')); assertEquals(response.status, 200); await response.body?.cancel(); assertEquals(sends, 1); }
  finally { globalThis.fetch = original; }
});