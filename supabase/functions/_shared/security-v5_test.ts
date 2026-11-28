import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ForecastBody, ManagementPackBody, forecastTenant } from './security-v5-input.ts';

const id = '00000000-0000-0000-0000-000000000001';
const foreign = '00000000-0000-0000-0000-000000000002';
const jobs = ['ticket-customer-reminder', 'escalation-engine', 'orders-inbox-process', 'alixdocs-expiry-scan', 'delivery-escalation-engine'];
const interactive = ['sync-zoho-to-finance', 'collect-morning-report', 'ac-report-snapshot', 'license-royalty-run', 'finance-reminder-engine', 'collect-engine', 'finance-management-pack', 'finance-ai-forecast'];
type Handler = (req: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();
function configure() {
  Deno.env.set('SUPABASE_URL', 'https://isolated-v5.example.test');
  Deno.env.set('SUPABASE_ANON_KEY', 'public-v5');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-v5');
  Deno.env.set('CRON_SECRET', 'cron-v5');
  Deno.env.delete('LOVABLE_API_KEY');
}
async function load(name: string) {
  const old = handlers.get(name); if (old) return old;
  const original = Deno.serve; let captured: Handler | undefined;
  Deno.serve = ((handler: Handler) => { captured = handler; return {}; }) as typeof Deno.serve;
  try { await import(`../${name}/index.ts`); } finally { Deno.serve = original; }
  if (!captured) throw new Error(`Missing ${name}`);
  handlers.set(name, captured); return captured;
}
const request = (token: string, body: unknown = {}) => new Request('https://app.example.test', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
function identity(url: URL, mode = 'active'): Response | null {
  if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id, email: 'staff@example.test' });
  if (url.pathname.endsWith('/user_profiles')) return Response.json({ is_active: mode !== 'inactive', account_status: mode === 'inactive' ? 'disabled' : 'active', invitation_status: 'accepted', password_reset_required: false });
  if (url.pathname.endsWith('/user_roles')) return Response.json([{ roles: { name: mode === 'unrelated' ? 'Read Only' : 'Admin' } }]);
  if (url.pathname.endsWith('/user_tenant_access')) return Response.json(mode === 'unassigned' ? [] : [{ tenant_id: id }]);
  if (url.pathname.endsWith('/tenants')) return Response.json([{ id, code: 'DE', zoho_source_system: 'zoho_eu_1' }]);
  return null;
}
for (const name of [...jobs, ...interactive]) {
  Deno.test(`v5 ${name}: public and forged access has no business or provider effects`, async () => {
    configure(); const handler = await load(name); const original = fetch; let business = 0;
    globalThis.fetch = async input => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ message: 'invalid' }, { status: 401 });
      business++; throw new Error('Unauthorized business access');
    };
    try {
      for (const token of ['', 'public-v5', 'forged']) { const r = await handler(request(token)); assertEquals(r.status, 401); await r.body?.cancel(); }
      assertEquals(business, 0);
    } finally { globalThis.fetch = original; }
  });
}
for (const name of jobs) {
  Deno.test(`v5 ${name}: human token cannot invoke a machine-only job`, async () => {
    configure(); const handler = await load(name); const original = fetch;
    globalThis.fetch = async () => { throw new Error('Human reached job records'); };
    try { const r = await handler(request('staff')); assertEquals(r.status, 401); await r.body?.cancel(); }
    finally { globalThis.fetch = original; }
  });
  Deno.test(`v5 ${name}: original private credential retains isolated empty job`, async () => {
    configure(); const handler = await load(name); const original = fetch; let reads = 0;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input)); assertEquals(url.hostname, 'isolated-v5.example.test');
      assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer service-v5');
      assertEquals(init?.method ?? 'GET', 'GET'); reads++; return Response.json([]);
    };
    try { const r = await handler(request('cron-v5')); assertEquals(r.status, 200); await r.body?.cancel(); assert(reads > 0); }
    finally { globalThis.fetch = original; }
  });
}
for (const name of interactive) {
  Deno.test(`v5 ${name}: inactive, unrelated or unassigned staff cannot reach records`, async () => {
    configure(); const handler = await load(name); const original = fetch; let mode = '';
    globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); const r = identity(url, mode); if (r) return r; throw new Error('Unauthorized records'); };
    try { for (mode of ['inactive', 'unrelated', 'unassigned']) { const r = await handler(request('staff')); assertEquals(r.status, 403); await r.body?.cancel(); } }
    finally { globalThis.fetch = original; }
  });
}
Deno.test('v5 finance input rejects malformed IDs, excessive recipients and ambiguous company writes', () => {
  assertEquals(ManagementPackBody.safeParse({ pack_id: 'invalid', action: 'generate' }).success, false);
  assertEquals(ManagementPackBody.safeParse({ pack_id: id, action: 'send' }).success, false);
  assertEquals(ManagementPackBody.safeParse({ pack_id: id, action: 'send', recipients: Array(51).fill('staff@example.test') }).success, false);
  assertEquals(ForecastBody.safeParse({ months: 13 }).success, false);
  assertEquals(forecastTenant([id], foreign), null); assertEquals(forecastTenant([id, foreign]), null); assertEquals(forecastTenant([id]), id);
});
Deno.test('v5 pack foreign company denied before writing', async () => {
  configure(); const handler = await load('finance-management-pack'); const original = fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); const r = identity(url); if (r) return r;
    assertEquals(init?.method ?? 'GET', 'GET'); assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff');
    return Response.json({ id, tenant_id: foreign, accounting_region: 'EU' });
  };
  try { const r = await handler(request('staff', { pack_id: id, action: 'generate' })); assertEquals(r.status, 403); await r.body?.cancel(); }
  finally { globalThis.fetch = original; }
});
Deno.test('v5 pack authorized write preserves caller rights and company filter', async () => {
  configure(); const handler = await load('finance-management-pack'); const original = fetch; let writes = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); const r = identity(url); if (r) return r;
    assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff');
    if (init?.method === 'PATCH') { assertEquals(url.searchParams.get('tenant_id'), `eq.${id}`); assertEquals(JSON.parse(String(init.body)).status, 'generated'); writes++; return Response.json({ id }); }
    return Response.json({ id, tenant_id: id, accounting_region: 'EU' });
  };
  try { const r = await handler(request('staff', { pack_id: id, action: 'generate' })); assertEquals(r.status, 200); await r.body?.cancel(); assertEquals(writes, 1); }
  finally { globalThis.fetch = original; }
});
Deno.test('v5 forecast rejects a foreign company before financial reads or AI', async () => {
  configure(); const handler = await load('finance-ai-forecast'); const original = fetch;
  globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); const r = identity(url); if (r) return r; throw new Error('Foreign forecast access'); };
  try { const r = await handler(request('staff', { tenant_id: foreign })); assertEquals(r.status, 403); await r.body?.cancel(); }
  finally { globalThis.fetch = original; }
});
Deno.test('v5 forecast uses only selected company and region, then writes with caller credentials', async () => {
  configure(); const handler = await load('finance-ai-forecast'); const original = fetch; let reads = 0, writes = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); const r = identity(url); if (r) return r;
    if (url.hostname === 'ai.gateway.lovable.dev') return Response.json({ choices: [{ message: { content: '[100,200]' } }] });
    assertEquals(url.hostname, 'isolated-v5.example.test'); assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff');
    if (url.pathname.endsWith('/finance_transactions')) { assertEquals(url.searchParams.get('tenant_id'), `eq.${id}`); assertEquals(url.searchParams.get('accounting_region'), 'eq.CH'); reads++; return Response.json([{ amount: 100, transaction_type: 'Rechnung', booking_date: '2026-11-01' }]); }
    assertEquals(url.pathname, '/rest/v1/finance_forecasts'); const rows = JSON.parse(String(init?.body)); assertEquals(rows.length, 2); assert(rows.every((row: any) => row.tenant_id === id && row.accounting_region === 'CH')); writes++; return new Response(null, { status: 201 });
  };
  try { const r = await handler(request('staff', { tenant_id: id, months: 2, accounting_region: 'CH' })); assertEquals(r.status, 200); await r.body?.cancel(); assertEquals(reads, 1); assertEquals(writes, 1); }
  finally { globalThis.fetch = original; }
});
Deno.test('v5 collection run never rebuilds other companies and scopes promises by authorized parent cases', async () => {
  configure(); const handler = await load('collect-engine'); const original = fetch; let promises = 0, writes = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); const r = identity(url); if (r) return r;
    assertEquals(url.hostname, 'isolated-v5.example.test'); assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff');
    assert(!url.pathname.includes('/rpc/collect_sync_cases'));
    if (url.pathname.endsWith('/collect_cases') && (init?.method ?? 'GET') === 'GET') { assertEquals(url.searchParams.get('tenant_id'), `in.(${id})`); return Response.json([{ id, tenant_id: id, customer_id: null, open_amount: 0, overdue_amount: 0 }]); }
    if (url.pathname.endsWith('/collect_promises') && (init?.method ?? 'GET') === 'GET') { assertEquals(url.searchParams.get('case_id'), `in.(${id})`); promises++; return Response.json([{ id, case_id: id, amount: 10 }]); }
    if (['collect_tasks', 'collect_payment_plans'].some(t => url.pathname.endsWith('/' + t)) && (init?.method ?? 'GET') === 'GET') assertEquals(url.searchParams.get('case_id'), `in.(${id})`);
    if (['PATCH', 'POST'].includes(init?.method ?? '')) { const body = JSON.parse(String(init?.body)); assert(!JSON.stringify(body).includes(foreign)); writes++; return new Response(null, { status: 201 }); }
    return Response.json([]);
  };
  try { const r = await handler(request('staff')); assertEquals(r.status, 200); await r.body?.cancel(); assertEquals(promises, 1); assert(writes > 0); }
  finally { globalThis.fetch = original; }
});