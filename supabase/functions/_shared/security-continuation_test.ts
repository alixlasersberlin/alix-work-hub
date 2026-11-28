import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { trustedAutomationContext, automationContact } from './automation-contact.ts';

const id = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const host = 'security-continuation.example.test';
type Handler = (req: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();
async function handler(name: string) {
  Deno.env.set('SUPABASE_URL', `https://${host}`);
  Deno.env.set('SUPABASE_ANON_KEY', 'public-continuation');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-continuation');
  Deno.env.set('CRON_SECRET', 'cron-continuation');
  const saved = handlers.get(name);
  if (saved) return saved;
  const original = Deno.serve;
  let captured: Handler | undefined;
  Deno.serve = ((fn: Handler) => { captured = fn; return {}; }) as typeof Deno.serve;
  try { await import(`../${name}/index.ts`); } finally { Deno.serve = original; }
  if (!captured) throw new Error('Handler missing');
  handlers.set(name, captured);
  return captured;
}
const request = (body: unknown, token = 'staff') => new Request(`https://${host}/test`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
function identity(u: URL, active = true): Response | null {
  if (u.pathname.endsWith('/auth/v1/user')) return Response.json({ id });
  if (u.pathname.endsWith('/user_profiles')) return Response.json({ is_active: active, account_status: active ? 'active' : 'disabled', invitation_status: 'accepted', password_reset_required: false });
  if (u.pathname.endsWith('/user_roles')) return Response.json([{ roles: { name: 'Admin' } }]);
  if (u.pathname.endsWith('/user_tenant_access')) return Response.json([{ tenant_id: id }]);
  if (u.pathname.endsWith('/tenants')) return Response.json([{ id }]);
  return null;
}

for (const name of ['ac-outreach-engine', 'ac-journey-trigger', 'ac-journey-run', 'ac-playbook-run', 'ac-segment-preview', 'ac-compliance-governance']) {
  Deno.test(`Continuation ${name} rejects public and forged access before data or provider calls`, async () => {
    const h = await handler(name), original = fetch;
    let businessCalls = 0;
    globalThis.fetch = async input => {
      const u = new URL(String(input instanceof Request ? input.url : input));
      if (u.pathname.endsWith('/auth/v1/user')) return Response.json({ error: 'invalid' }, { status: 401 });
      businessCalls++; throw new Error('Unauthorized business call');
    };
    try {
      for (const token of ['', 'public-continuation', 'forged']) {
        const r = await h(request({}, token)); assertEquals(r.status, 401); await r.body?.cancel();
      }
      assertEquals(businessCalls, 0);
    } finally { globalThis.fetch = original; }
  });
  Deno.test(`Continuation ${name} rejects inactive administrators`, async () => {
    const h = await handler(name), original = fetch;
    globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u, false); if (r) return r; throw new Error('Inactive data call'); };
    try { const r = await h(request({})); assertEquals(r.status, 403); await r.body?.cancel(); } finally { globalThis.fetch = original; }
  });
}

Deno.test('Journey metadata cannot replace stored contact, customer, tenant or recipient', () => {
  const ctx = trustedAutomationContext({ id, tenant_id: id, customer_id: id, email: 'stored@example.test', phone: '+49123456789' }, { id: other, tenant_id: other, customer_id: other, email: 'attacker@example.test', phone: '+49999999999', custom: 5 });
  assertEquals(ctx.id, id); assertEquals(ctx.tenant_id, id); assertEquals(ctx.customer_id, id);
  assertEquals(ctx.email, 'stored@example.test'); assertEquals(ctx.phone, '+49123456789'); assertEquals(ctx.custom, 5);
});

Deno.test('Journey never fabricates a contact when its authorized lookup is missing', async () => {
  const sb = { from: () => ({ select: () => ({ eq: () => ({ in: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }) };
  let rejected = false;
  try { await automationContact(sb, id, [id]); } catch { rejected = true; }
  assertEquals(rejected, true);
});

Deno.test('Segment inline filter cannot bypass the stored segment check', async () => {
  const h = await handler('ac-segment-preview'), original = fetch;
  let reads = 0;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r; reads++; assert(u.pathname.endsWith('/ac_segments')); assertEquals(u.searchParams.get('id'), `eq.${other}`); return Response.json(null); };
  try { const r = await h(request({ segment_id: other, filter: {} })); assertEquals(r.status, 404); await r.body?.cancel(); assertEquals(reads, 1); } finally { globalThis.fetch = original; }
});

Deno.test('Segment failed persistence is not reported as success', async () => {
  const h = await handler('ac-segment-preview'), original = fetch;
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r;
    if (init?.method === 'PATCH') return Response.json({ message: 'write denied' }, { status: 403 });
    if (u.pathname.endsWith('/ac_segments')) return Response.json({ filter: {} });
    if (u.pathname.endsWith('/ac_contacts')) return Response.json([{ id }]);
    throw new Error('Unexpected call');
  };
  try { const r = await h(request({ segment_id: id })); assertEquals(r.status, 500); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});

Deno.test('Journey trigger rejects readable contact outside assigned tenant before enrollment', async () => {
  const h = await handler('ac-journey-trigger'), original = fetch;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r; assert(u.pathname.endsWith('/ac_contacts')); assertEquals(u.searchParams.get('tenant_id'), `in.(${id})`); return Response.json({ id, tenant_id: other }); };
  try { const r = await h(request({ event_type: 'test', contact_id: id })); assertEquals(r.status, 404); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});

Deno.test('Journey trigger enrollment uses the authorized contact and retains immutable context identity', async () => {
  const h = await handler('ac-journey-trigger'), original = fetch;
  let inserted: any;
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r;
    assertEquals(u.hostname, host);
    if (u.pathname.endsWith('/ac_contacts')) return Response.json({ id, tenant_id: id, full_name: 'Synthetic', email: 'stored@example.test' });
    if (u.pathname.endsWith('/ac_journeys')) return Response.json([{ id }]);
    if (u.pathname.endsWith('/ac_journey_runs')) {
      if (init?.method === 'POST') { inserted = JSON.parse(String(init.body)); return new Response(null, { status: 201 }); }
      return Response.json([]);
    }
    throw new Error('Unexpected call');
  };
  try { const r = await h(request({ event_type: 'test', contact_id: id, payload: { email: 'attacker@example.test' } })); assertEquals(r.status, 200); assertEquals((await r.json()).started, 1); assertEquals(inserted.contact_id, id); assertEquals(inserted.context.trigger_payload.email, 'attacker@example.test'); assertEquals(inserted.context.email, undefined); } finally { globalThis.fetch = original; }
});

Deno.test('Outreach skips cross-tenant customer before throttle history or queue writes', async () => {
  const h = await handler('ac-outreach-engine'), original = fetch;
  globalThis.fetch = async input => {
    const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r;
    if (u.pathname.endsWith('/ac_outreach_triggers')) return Response.json([{ id, event_type: 'no_contact_days', conditions: {} }]);
    if (u.pathname.endsWith('/ac_contacts')) return Response.json([{ id, customer_id: id }]);
    if (u.pathname.endsWith('/customers')) return Response.json({ id, contact_tenant_id: other });
    throw new Error('Foreign queue or history reached');
  };
  try { const r = await h(request({ dry_run: true })); assertEquals(r.status, 200); const j = await r.json(); assertEquals(j.queued, 0); assertEquals(j.skipped, 1); } finally { globalThis.fetch = original; }
});

Deno.test('Compliance aggregate reads all carry explicit assigned tenant constraints', async () => {
  const h = await handler('ac-compliance-governance'), original = fetch;
  let scoped = 0;
  globalThis.fetch = async input => {
    const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r;
    assertEquals(u.hostname, host);
    if (u.pathname.endsWith('/ac_contacts')) {
      assertEquals(u.searchParams.get('tenant_id'), `in.(${id})`);
      return Response.json([{ id }]);
    }
    assertEquals(u.searchParams.get(u.pathname.endsWith('/ac_conversations') ? 'tenant_id' : 'contact_id'), `in.(${id})`);
    scoped++; return new Response(null, { headers: { 'Content-Range': '*/3' } });
  };
  try { const r = await h(request({ op: 'audit' })); assertEquals(r.status, 200); const j = await r.json(); assertEquals(j.metrics.total_calls, 3); assertEquals(j.metrics.total_conversations, 3); assertEquals(scoped, 5); } finally { globalThis.fetch = original; }
});

Deno.test('Compliance cannot bind a valid conversation to a different valid contact', async () => {
  const h = await handler('ac-compliance-governance'), original = fetch;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r; if (u.pathname.endsWith('/ac_contacts')) return Response.json({ id, tenant_id: id }); if (u.pathname.endsWith('/ac_conversations')) return Response.json({ id, tenant_id: id, contact_id: other }); throw new Error('Mismatched log write'); };
  try { const r = await h(request({ op: 'log', contact_id: id, conversation_id: id })); assertEquals(r.status, 409); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});