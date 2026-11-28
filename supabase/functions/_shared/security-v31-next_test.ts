import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const jobs = ['ac-journey-tick', 'ac-segment-auto-enroll', 'alixdocs2-workflow-scan', 'alixdocs-hash-backfill', 'alixdocs-learn-rules', 'ac-automation-run', 'ac-webhook-dispatch', 'delivery-reminder-engine', 'follow-up-reminder-engine', 'fleet-maintenance-alerts', 'ac-sla-check'];
const interactive = ['ac-workflow-studio', 'ac-conversation-qa', 'ai-center-chat'];
const names = [...jobs, 'social-competitors-sync', ...interactive];
const machineOnly = ['ac-journey-tick', 'ac-webhook-dispatch', 'delivery-reminder-engine', 'follow-up-reminder-engine'];
const validBody = (name: string) => name === 'ac-automation-run' ? { event: 'conversation.created' } : {};
type Handler = (req: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();
async function load(name: string) {
  if (handlers.has(name)) return handlers.get(name) as Handler;
  const original = Deno.serve; let captured: Handler | undefined;
  Deno.serve = ((handler: Handler) => { captured = handler; return {}; }) as typeof Deno.serve;
  try { await import(`../${name}/index.ts`); } finally { Deno.serve = original; }
  if (!captured) throw new Error(`Missing handler ${name}`);
  handlers.set(name, captured); return captured;
}
const id = '00000000-0000-0000-0000-000000000001';
function configure() {
  Deno.env.set('SUPABASE_URL', 'https://isolated-next.example.test');
  Deno.env.set('SUPABASE_ANON_KEY', 'public-fixture');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-fixture');
  Deno.env.set('CRON_SECRET', 'cron-fixture');
  Deno.env.set('LOVABLE_API_KEY', 'ai-fixture');
}
const req = (token: string, body: unknown = {}) => new Request('https://app.example.test', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
function identity(url: URL, active = true, membership = true, role = 'Admin'): Response | null {
  if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id });
  if (url.pathname.endsWith('/user_profiles')) return Response.json({ is_active: active, account_status: active ? 'active' : 'disabled', invitation_status: 'accepted', password_reset_required: false });
  if (url.pathname.endsWith('/user_roles')) return Response.json([{ roles: { name: role } }]);
  if (url.pathname.endsWith('/user_tenant_access')) return Response.json(membership ? [{ tenant_id: id }] : []);
  if (url.pathname.endsWith('/tenants')) return Response.json([{ id, code: 'DE' }]);
  return null;
}
for (const name of names) {
  Deno.test(`${name}: public and forged credentials cannot access business data`, async () => {
    configure(); const handler = await load(name); const original = fetch; let business = 0;
    globalThis.fetch = async input => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ message: 'invalid' }, { status: 401 });
      business++; throw new Error('Unauthorized data access');
    };
    try {
      for (const token of ['', 'public-fixture', 'forged-private']) {
        const response = await handler(req(token)); assertEquals(response.status, 401); await response.body?.cancel();
      }
      assertEquals(business, 0);
    } finally { globalThis.fetch = original; }
  });
}
for (const name of jobs) {
  Deno.test(`${name}: existing private scheduler completes isolated empty scope without sending`, async () => {
    configure(); const handler = await load(name); const original = fetch; let reads = 0;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      assertEquals(url.hostname, 'isolated-next.example.test');
      assertEquals(init?.method ?? (input instanceof Request ? input.method : 'GET'), 'GET');
      reads++; return Response.json([]);
    };
    try { const response = await handler(req('cron-fixture', validBody(name))); assertEquals(response.status, 200); await response.body?.cancel(); assert(reads > 0); }
    finally { globalThis.fetch = original; }
  });
}
for (const name of names.filter(n => !machineOnly.includes(n) && !interactive.includes(n))) {
  Deno.test(`${name}: inactive and unassigned employees cannot run maintenance`, async () => {
    configure(); const handler = await load(name); const original = fetch; let active = false, member = true, business = 0;
    globalThis.fetch = async input => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      assertEquals(url.hostname, 'isolated-next.example.test');
      const response = identity(url, active, member); if (response) return response;
      business++; throw new Error('Unauthorized maintenance');
    };
    try {
      let response = await handler(req('staff')); assertEquals(response.status, 403); await response.body?.cancel();
      active = true; member = false;
      response = await handler(req('staff')); assertEquals(response.status, 403); await response.body?.cancel(); assertEquals(business, 0);
    } finally { globalThis.fetch = original; }
  });
  Deno.test(`${name}: human reads retain the employee credential and existing row permissions`, async () => {
    configure(); const handler = await load(name); const original = fetch; let business = 0;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      assertEquals(url.hostname, 'isolated-next.example.test');
      const response = identity(url); if (response) return response;
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      assertEquals(headers.get('authorization'), 'Bearer staff'); assertEquals(headers.get('apikey'), 'public-fixture');
      business++;
      if (url.pathname.endsWith('/rpc/can_admin_social')) return Response.json(true);
      assertEquals(init?.method ?? 'GET', 'GET'); return Response.json([]);
    };
    try { const response = await handler(req('staff', validBody(name))); assertEquals(response.status, 200); await response.body?.cancel(); assert(business > 0); }
    finally { globalThis.fetch = original; }
  });
}
for (const [name, body] of [['alixdocs-hash-backfill', { batch: -1 }], ['alixdocs-learn-rules', { since_days: -1 }], ['social-competitors-sync', { client_id: 'foreign-filter' }]] as const) {
  Deno.test(`${name}: malformed scope input is rejected before data access`, async () => {
    configure(); const handler = await load(name); const original = fetch;
    globalThis.fetch = async input => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      const response = identity(url); if (response) return response;
      if (url.pathname.endsWith('/rpc/can_admin_social')) return Response.json(true);
      throw new Error('Invalid input reached data');
    };
    try { const response = await handler(req('staff', body)); assertEquals(response.status, 400); await response.body?.cancel(); }
    finally { globalThis.fetch = original; }
  });
}
Deno.test('social competitors: read-only role cannot run write operations', async () => {
  configure(); const handler = await load('social-competitors-sync'); const original = fetch;
  globalThis.fetch = async input => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    const response = identity(url); if (response) return response;
    if (url.pathname.endsWith('/rpc/can_admin_social')) return Response.json(false);
    throw new Error('Read role reached competitor writes');
  };
  try { const response = await handler(req('staff')); assertEquals(response.status, 403); await response.body?.cancel(); }
  finally { globalThis.fetch = original; }
});
Deno.test('social competitors: authorized isolated snapshot keeps caller credential for both writes', async () => {
  configure(); const handler = await load('social-competitors-sync'); const original = fetch; let writes = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    assertEquals(url.hostname, 'isolated-next.example.test');
    const response = identity(url); if (response) return response;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    assertEquals(headers.get('authorization'), 'Bearer staff');
    if (url.pathname.endsWith('/rpc/can_admin_social')) return Response.json(true);
    if ((init?.method ?? 'GET') === 'GET') return Response.json([{ id, handle: 'synthetic', client_id: id }]);
    assert(['POST', 'PATCH'].includes(init?.method ?? '')); writes++; return new Response(null, { status: 201 });
  };
  try { const response = await handler(req('staff', { client_id: id })); assertEquals(response.status, 200); assertEquals((await response.json()).updated, 1); assertEquals(writes, 2); }
  finally { globalThis.fetch = original; }
});

for (const name of ['ac-automation-run', 'ac-segment-auto-enroll', 'alixdocs2-workflow-scan', 'alixdocs-hash-backfill', 'alixdocs-learn-rules', 'ac-sla-check', 'fleet-maintenance-alerts', 'ac-workflow-studio', 'ac-conversation-qa']) {
  Deno.test(`${name}: Finance cannot inherit administration or planning rights`, async () => {
    configure(); const handler = await load(name); const original = fetch;
    globalThis.fetch = async input => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      const response = identity(url, true, true, 'Finance'); if (response) return response;
      throw new Error('Wrong role reached business data');
    };
    try { const response = await handler(req('staff', validBody(name))); assertEquals(response.status, 403); await response.body?.cancel(); }
    finally { globalThis.fetch = original; }
  });
}
for (const role of ['Tourenplanung', 'Order', 'SACHBEARBEITUNG']) {
  Deno.test(`fleet maintenance: existing ${role} planning role retains authorized read scope`, async () => {
    configure(); const handler = await load('fleet-maintenance-alerts'); const original = fetch;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      assertEquals(url.hostname, 'isolated-next.example.test');
      const response = identity(url, true, true, role); if (response) return response;
      assertEquals(url.pathname, '/rest/v1/vehicles');
      assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff');
      return Response.json([]);
    };
    try { const response = await handler(req('staff')); assertEquals(response.status, 200); await response.body?.cancel(); }
    finally { globalThis.fetch = original; }
  });
}
Deno.test('automation cannot process a foreign conversation or unrelated message', async () => {
  configure(); const handler = await load('ac-automation-run'); const original = fetch; let missing = true;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    assertEquals(url.hostname, 'isolated-next.example.test');
    const response = identity(url); if (response) return response;
    assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff');
    if (url.pathname.endsWith('/ac_conversations')) return Response.json(missing ? null : { channel_type: 'email', tenant_id: id });
    if (url.pathname.endsWith('/ac_messages')) return Response.json({ conversation_id: '00000000-0000-0000-0000-000000000002' });
    throw new Error('Foreign resource reached automation rules or writes');
  };
  try {
    let response = await handler(req('staff', { event: 'message.received', conversation_id: id }));
    assertEquals(response.status, 404); await response.body?.cancel(); missing = false;
    response = await handler(req('staff', { event: 'message.received', conversation_id: id, message_id: id }));
    assertEquals(response.status, 404); await response.body?.cancel();
  } finally { globalThis.fetch = original; }
});

Deno.test('workflow validation remains available to an authorized administrator without writes', async () => {
  configure(); const handler = await load('ac-workflow-studio'); const original = fetch;
  globalThis.fetch = async input => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    assertEquals(url.hostname, 'isolated-next.example.test');
    const response = identity(url); if (response) return response;
    throw new Error('Validation attempted a write or external call');
  };
  try {
    const response = await handler(req('staff', { op: 'validate', flow: { name: 'Synthetic flow', nodes: [{ id: 'start', type: 'trigger', kind: 'message_received' }] } }));
    assertEquals(response.status, 200); assertEquals((await response.json()).ok, true);
  } finally { globalThis.fetch = original; }
});
Deno.test('QA rejects missing authorized conversation before any AI call or write', async () => {
  configure(); const handler = await load('ac-conversation-qa'); const original = fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    assertEquals(url.hostname, 'isolated-next.example.test');
    const response = identity(url); if (response) return response;
    assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff');
    assertEquals(url.pathname, '/rest/v1/ac_conversations');
    assertEquals(url.searchParams.get('tenant_id'), `in.(${id})`); return Response.json([]);
  };
  try { const response = await handler(req('staff', { conversation_id: id })); assertEquals(response.status, 404); await response.body?.cancel(); }
  finally { globalThis.fetch = original; }
});
Deno.test('QA authorized synthetic conversation is analyzed and stores only the selected identity', async () => {
  configure(); const handler = await load('ac-conversation-qa'); const original = fetch; let ai = 0, writes = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    if (url.hostname === 'ai.gateway.lovable.dev') {
      ai++; return Response.json({ choices: [{ message: { content: JSON.stringify({ overall: 85, strengths: [], improvements: [], summary: 'Synthetic' }) } }] });
    }
    assertEquals(url.hostname, 'isolated-next.example.test');
    const response = identity(url); if (response) return response;
    const headers = new Headers(init?.headers);
    if (url.pathname.endsWith('/ac_conversation_qa')) {
      assertEquals(init?.method, 'POST'); assertEquals(headers.get('authorization'), 'Bearer service-fixture');
      const row = JSON.parse(String(init?.body)); assertEquals(row.conversation_id, id); assertEquals(row.agent_user_id, id); assertEquals(row.overall_score, 85);
      writes++; return new Response(null, { status: 201 });
    }
    assertEquals(headers.get('authorization'), 'Bearer staff');
    if (url.pathname.endsWith('/ac_conversations')) {
      assertEquals(url.searchParams.get('tenant_id'), `in.(${id})`);
      assert(url.searchParams.get('select')?.includes('assigned_to'));
      return Response.json([{ id, assigned_to: id, status: 'closed', created_at: '2026-11-28T01:00:00Z', closed_at: '2026-11-28T01:05:00Z' }]);
    }
    assertEquals(url.pathname, '/rest/v1/ac_messages'); assertEquals(url.searchParams.get('conversation_id'), `eq.${id}`);
    return Response.json([{ direction: 'inbound', body: 'Synthetic question', created_at: '2026-11-28T01:00:00Z' }, { direction: 'outbound', body: 'Synthetic answer', created_at: '2026-11-28T01:01:00Z' }]);
  };
  try { const response = await handler(req('staff', { conversation_id: id })); assertEquals(response.status, 200); assertEquals((await response.json()).evaluated, 1); assertEquals(ai, 1); assertEquals(writes, 1); }
  finally { globalThis.fetch = original; }
});
Deno.test('AI center permits an authorized synthetic chat without changing its existing message contract', async () => {
  configure(); const handler = await load('ai-center-chat'); const original = fetch; let ai = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    if (url.hostname === 'ai.gateway.lovable.dev') {
      const body = JSON.parse(String(init?.body)); assertEquals(body.messages[0].role, 'system'); assertEquals(body.messages[1].content, 'Synthetic question');
      ai++; return Response.json({ choices: [{ message: { content: 'Synthetic answer' } }] });
    }
    assertEquals(url.hostname, 'isolated-next.example.test');
    const response = identity(url); if (response) return response;
    throw new Error('Unexpected business data access');
  };
  try { const response = await handler(req('staff', { messages: [{ role: 'user', content: 'Synthetic question' }] })); assertEquals(response.status, 200); assertEquals((await response.json()).content, 'Synthetic answer'); assertEquals(ai, 1); }
  finally { globalThis.fetch = original; }
});
