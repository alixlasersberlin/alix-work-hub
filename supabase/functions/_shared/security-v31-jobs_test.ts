import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const names = ['ticket-sla-check', 'ticket-escalation-engine', 'audit-alert-digest', 'offers-ai-autoscore', 'delivery-rating-report', 'delivery-approval-escalation', 'as-workflows-run'];
type Handler = (req: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();
async function load(name: string) {
  const existing = handlers.get(name);
  if (existing) return existing;
  const original = Deno.serve;
  let captured: Handler | undefined;
  Deno.serve = ((handler: Handler) => { captured = handler; return {}; }) as typeof Deno.serve;
  try { await import(`../${name}/index.ts`); } finally { Deno.serve = original; }
  if (!captured) throw new Error(`Missing handler: ${name}`);
  handlers.set(name, captured);
  return captured;
}
function configure() {
  Deno.env.set('SUPABASE_URL', 'https://isolated-job-v31.example.test');
  Deno.env.set('SUPABASE_ANON_KEY', 'public-fixture');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-fixture');
  Deno.env.set('CRON_SECRET', 'cron-fixture');
  Deno.env.delete('RESEND_API_KEY');
  Deno.env.delete('LOVABLE_API_KEY');
}
for (const name of names) {
  Deno.test(`${name}: public and forged callers cannot run automatic business operations`, async () => {
    configure(); const handler = await load(name); const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = () => { calls++; throw new Error('Public caller reached protected operation'); };
    try {
      for (const token of ['', 'public-fixture', 'forged-service']) {
        const response = await handler(new Request('https://app.example.test', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: '{}' }));
        assertEquals(response.status, 401); await response.body?.cancel();
      }
      assertEquals(calls, 0);
    } finally { globalThis.fetch = original; }
  });
  Deno.test(`${name}: existing private scheduler succeeds against empty isolated data`, async () => {
    configure(); const handler = await load(name); const original = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      assertEquals(url.hostname, 'isolated-job-v31.example.test');
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      if (name === 'ticket-sla-check') {
        assertEquals(url.pathname, '/rest/v1/rpc/ticket_sla_check_and_escalate');
        assertEquals(method, 'POST');
      } else assertEquals(method, 'GET');
      calls.push(url.pathname);
      return Response.json([]);
    };
    try {
      const response = await handler(new Request('https://app.example.test', { method: 'POST', headers: { 'x-cron-secret': 'cron-fixture' }, body: '{}' }));
      assertEquals(response.status, 200); await response.body?.cancel();
      assert(calls.length > 0);
    } finally { globalThis.fetch = original; }
  });
}