import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// Execute actual handlers with all network operations intercepted. No live job,
// customer record, provider message or synchronization can leave these tests.
Deno.test('nine existing automated handlers accept private callers and reject public keys before access', async () => {
  const originalServe = Deno.serve;
  const originalFetch = globalThis.fetch;
  const fixtures: Record<string,string> = {
    SUPABASE_URL: 'https://security-fixture.example.test', SUPABASE_ANON_KEY: 'public-fixture',
    SUPABASE_SERVICE_ROLE_KEY: 'private-service-fixture', CRON_SECRET: 'private-cron-fixture',
    ALIXSMART_WEBHOOK_SECRET: 'private-webhook-fixture', ALIXSMART_API_BASE_URL: 'https://provider-fixture.example.test',
    ZOHO_EU_1_CLIENT_ID: 'fixture-client', ZOHO_EU_1_CLIENT_SECRET: 'fixture-client-secret',
    ZOHO_EU_1_REFRESH_TOKEN: 'fixture-refresh', ZOHO_EU_1_ORGANIZATION_ID: 'fixture-org',
  };
  for (const [key,value] of Object.entries(fixtures)) Deno.env.set(key,value);
  let handler: ((req: Request) => Response | Promise<Response>) | undefined;
  let calls = 0;
  Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: (callback: typeof handler) => {
    handler = callback;
    return { shutdown: async () => {}, finished: Promise.resolve() };
  } });
  const fixtureFetch: typeof fetch = async (input, init) => {
    calls++;
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    if (url.pathname.endsWith('/auth/v1/user')) return new Response('{"message":"Invalid fixture user"}', { status: 401, headers: { 'Content-Type': 'application/json' } });
    let body: unknown = [];
    if (url.pathname.endsWith('/oauth/v2/token')) body = { access_token: 'fixture-access-token' };
    else if (url.pathname.endsWith('/books/v3/contacts')) body = { contacts: [], page_context: { has_more_page: false } };
    else if (url.pathname.endsWith('/books/v3/salesorders')) body = { salesorders: [], page_context: { has_more_page: false } };
    else if (url.pathname.includes('rz_reminder_settings')) body = [{ auto_enabled: false }];
    else if (url.pathname.includes('sys_health_runs') && method === 'POST') body = { id: '00000000-0000-0000-0000-000000000001' };
    else if (url.pathname.includes('/rpc/sys_health_metrics')) body = {};
    else if (url.hostname === 'provider-fixture.example.test') body = { ok: true };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const names = ['scheduled-customer-sync','scheduled-order-sync','rz-reminder-build','portal-contract-reminders','survey-auto-reminders','survey-automation','system-health-scan','sig-webhook-dispatch','alixsmart-emit'];
  try {
    for (const name of names) {
      handler = undefined;
      globalThis.fetch = fixtureFetch;
      await import(`../${name}/index.ts`);
      const callback = handler as ((req: Request) => Response | Promise<Response>) | undefined;
      assert(callback, `handler registered: ${name}`);
      globalThis.fetch = fixtureFetch;
      const body = name === 'alixsmart-emit' ? { event: 'test.fixture', data: {} } : name === 'sig-webhook-dispatch' ? { event: 'test.fixture' } : { dry_run: true, autofix: false };
      calls = 0;
      const publicResponse = await callback(new Request('https://security-fixture.example.test', { method: 'POST', headers: { apikey: 'public-fixture', Authorization: 'Bearer public-fixture' }, body: JSON.stringify(body) }));
      assertEquals(publicResponse.status, 401, `${name}: public caller denied`);
      assertEquals(calls, ['scheduled-customer-sync','scheduled-order-sync','rz-reminder-build','survey-automation','system-health-scan'].includes(name) ? 1 : 0, `${name}: no private data access for public callers`);
      // User-capable handlers may query the mocked Auth service; machine-only
      // handlers reject immediately. All requests remain intercepted.
      const privateResponse = await callback(new Request('https://security-fixture.example.test', { method: 'POST', headers: { Authorization: 'Bearer private-cron-fixture' }, body: JSON.stringify(body) }));
      assertEquals(privateResponse.status, 200, `${name}: private fixture caller accepted`);
    }
  } finally {
    Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: originalServe });
    globalThis.fetch = originalFetch;
  }
});