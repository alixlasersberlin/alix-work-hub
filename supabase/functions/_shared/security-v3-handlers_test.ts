import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const interactive = ['product-hub-import', 'product-hub-validate', 'ph-en-batch', 'security-auto-scan', 'ac-agent-assist-live', 'ac-knowledge-rag', 'ac-revenue-forecast', 'ac-customer-intel', 'ac-voicemail-transcribe', 'alixdocs-attach-from-storage', 'alix-sign-resend', 'finance-datev-export', 'finance-bank-import', 'finance-camt054-import', 'finance-sepa-export', 'finance-ch-dd-export', 'finance-automations-engine', 'bank-api-fetch', 'bank-auto-reconcile', 'cmr-bank-automatch', 'cmr-recurring-run', 'cmr-collective-run', 'bank-return-dunning-escalate'];
type Handler = (req: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();

async function load(name: string): Promise<Handler> {
  const existing = handlers.get(name);
  if (existing) return existing;
  const original = Deno.serve;
  let captured: Handler | undefined;
  Deno.serve = ((handler: Handler) => { captured = handler; return {}; }) as typeof Deno.serve;
  try { await import(`../${name}/index.ts`); } finally { Deno.serve = original; }
  if (!captured) throw new Error(`No handler registered for ${name}`);
  handlers.set(name, captured);
  return captured;
}

function env() {
  Deno.env.set('SUPABASE_URL', 'https://isolated-security.example.test');
  Deno.env.set('SUPABASE_ANON_KEY', 'fixture-public');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'fixture-service');
  Deno.env.set('CRON_SECRET', 'fixture-cron');
  Deno.env.set('PBX_3CX_WEBHOOK_SECRET', 'fixture-provider');
  Deno.env.set('TWILIO_AUTH_TOKEN', 'fixture-twilio');
  Deno.env.delete('RESEND_API_KEY');
  Deno.env.delete('BANK_API_TOKEN');
}

for (const name of interactive) {
  Deno.test(`${name}: public and forged callers cannot reach business data or providers`, async () => {
    env(); const handler = await load(name); const original = globalThis.fetch;
    let protectedCalls = 0;
    globalThis.fetch = async (input) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.endsWith('/auth/v1/user')) return Response.json({ message: 'invalid session' }, { status: 401 });
      protectedCalls++; throw new Error('Business/provider access before authentication');
    };
    try {
      const invalidHeaders: Record<string, string>[] = [{}, { Authorization: 'Bearer fixture-public', apikey: 'fixture-public' }, { Authorization: 'Bearer forged-session' }];
      for (const headers of invalidHeaders) {
        const response = await handler(new Request('https://app.example.test', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' }));
        assertEquals(response.status, 401);
        await response.body?.cancel();
      }
      assertEquals(protectedCalls, 0);
    } finally { globalThis.fetch = original; }
  });
}

for (const name of ['ac-3cx-webhook', 'ac-voice-twilio-webhook']) {
  Deno.test(`${name}: forged provider delivery has no side effects`, async () => {
    env(); const handler = await load(name); const original = globalThis.fetch;
    globalThis.fetch = () => { throw new Error('Forged provider reached network'); };
    try {
      const response = await handler(new Request('https://app.example.test', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'CallSid=forged' }));
      assertEquals(response.status, 401); await response.body?.cancel();
    } finally { globalThis.fetch = original; }
  });
}

for (const name of ['cmr-bank-automatch', 'cmr-recurring-run', 'cmr-collective-run', 'finance-automations-engine', 'bank-auto-reconcile']) {
  Deno.test(`${name}: active scoped manual and existing private job contracts remain executable without business actions`, async () => {
    env(); const handler = await load(name); const original = globalThis.fetch;
    let reads: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      assertEquals(url.hostname, 'isolated-security.example.test');
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      assertEquals(method, 'GET');
      if (url.pathname === '/auth/v1/user') return Response.json({ id: '00000000-0000-0000-0000-000000000001' });
      if (url.pathname.endsWith('/user_profiles')) return Response.json({ is_active: true, account_status: 'active', invitation_status: 'accepted', password_reset_required: false });
      if (url.pathname.endsWith('/user_roles')) return Response.json([{ roles: { name: 'Admin' } }]);
      if (url.pathname.endsWith('/user_tenant_access')) return Response.json([{ tenant_id: '00000000-0000-0000-0000-000000000002' }]);
      if (url.pathname.endsWith('/tenants')) return Response.json([{ id: '00000000-0000-0000-0000-000000000002', code: 'DE', zoho_source_system: 'zoho_eu_1' }]);
      reads.push(url.toString()); return Response.json([]);
    };
    try {
      const manual = await handler(new Request('https://app.example.test', { method: 'POST', headers: { Authorization: 'Bearer fixture-user', 'Content-Type': 'application/json' }, body: '{}' }));
      assertEquals(manual.status, 200); await manual.body?.cancel();
      assert(reads.length > 0);
      assert(reads.every((url) => new URL(url).searchParams.has('tenant_id') || new URL(url).searchParams.get('or')?.includes('tenant_id.in.')));
      reads = [];
      const automatic = await handler(new Request('https://app.example.test', { method: 'POST', headers: { 'x-cron-secret': 'fixture-cron', 'Content-Type': 'application/json' }, body: '{}' }));
      assertEquals(automatic.status, 200); await automatic.body?.cancel();
      assert(reads.length > 0);
    } finally { globalThis.fetch = original; }
  });
}