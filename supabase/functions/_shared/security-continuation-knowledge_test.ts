import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
const id = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const host = 'security-knowledge.example.test';
type Handler = (req: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();
async function load(name: string) {
  Deno.env.set('SUPABASE_URL', `https://${host}`); Deno.env.set('SUPABASE_ANON_KEY', 'public-knowledge'); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-knowledge'); Deno.env.set('CRON_SECRET', 'cron-knowledge'); Deno.env.set('LOVABLE_API_KEY', 'synthetic-knowledge');
  const saved = handlers.get(name); if (saved) return saved;
  const original = Deno.serve; let h: Handler | undefined;
  Deno.serve = ((fn: Handler) => { h = fn; return {}; }) as typeof Deno.serve;
  try { await import(`../${name}/index.ts`); } finally { Deno.serve = original; }
  if (!h) throw new Error('Missing handler'); handlers.set(name, h); return h;
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
for (const name of ['ac-kb-ai-draft', 'ac-segment-auto-enroll']) {
  Deno.test(`Knowledge ${name} rejects public and forged callers before private data reads`, async () => {
    const h = await load(name), original = fetch; let forbidden = 0;
    globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); if (u.pathname.endsWith('/auth/v1/user')) return Response.json({ message: 'invalid' }, { status: 401 }); forbidden++; throw new Error('Forbidden data access'); };
    try { for (const t of ['', 'public-knowledge', 'forged']) { const r = await h(request({}, t)); assertEquals(r.status, 401); await r.body?.cancel(); } assertEquals(forbidden, 0); } finally { globalThis.fetch = original; }
  });
  Deno.test(`Knowledge ${name} rejects inactive account before all business operations`, async () => {
    const h = await load(name), original = fetch;
    globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u, false); if (r) return r; throw new Error('Inactive data access'); };
    try { const r = await h(request({})); assertEquals(r.status, 403); await r.body?.cancel(); } finally { globalThis.fetch = original; }
  });
}
Deno.test('Knowledge drafts never read messages from a foreign tenant conversation', async () => {
  const h = await load('ac-kb-ai-draft'), original = fetch;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r; assert(u.pathname.endsWith('/ac_conversations')); assertEquals(u.searchParams.get('tenant_id'), `in.(${id})`); return Response.json([{ id, tenant_id: foreign }]); };
  try { const r = await h(request({})); assertEquals(r.status, 200); assertEquals((await r.json()).drafts, []); } finally { globalThis.fetch = original; }
});
Deno.test('Knowledge input bounds reject oversized batch before reading private data', async () => {
  const h = await load('ac-kb-ai-draft'), original = fetch;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r; throw new Error('Invalid batch read data'); };
  try { const r = await h(request({ limit: 100000 })); assertEquals(r.status, 400); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});
Deno.test('Knowledge draft uses assigned tenant messages, remains nonpublic and records verified author', async () => {
  const h = await load('ac-kb-ai-draft'), original = fetch; let inserted: any; let generated = 0;
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r;
    if (u.hostname === 'ai.gateway.lovable.dev') { generated++; return Response.json({ choices: [{ message: { content: JSON.stringify({ title: 'Synthetic article', content: 'Synthetic text', tags: [], public_visible: true, author_id: foreign }) } }] }); }
    assertEquals(u.hostname, host);
    if (u.pathname.endsWith('/ac_conversations')) return Response.json([{ id, tenant_id: id, subject: 'Synthetic' }]);
    if (u.pathname.endsWith('/ac_messages')) { assertEquals(u.searchParams.get('tenant_id'), `eq.${id}`); return Response.json([{ sender_type: 'contact', body: 'Synthetic content '.repeat(30) }]); }
    if (u.pathname.endsWith('/ac_kb_articles')) { assertEquals(init?.method, 'POST'); inserted = JSON.parse(String(init.body)); return Response.json({ id, title: inserted.title }); }
    throw new Error('Unexpected request');
  };
  try { const r = await h(request({})); assertEquals(r.status, 200); assertEquals((await r.json()).drafts.length, 1); assertEquals(inserted.public_visible, false); assertEquals(inserted.status, 'review'); assertEquals(inserted.author_id, id); assertEquals(generated, 1); } finally { globalThis.fetch = original; }
});
Deno.test('Auto enrollment cannot process contacts outside assigned tenants', async () => {
  const h = await load('ac-segment-auto-enroll'), original = fetch;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r; if (u.pathname.endsWith('/ac_journey_segments')) return Response.json([{ id, auto_enroll_journey_id: id }]); if (u.pathname.endsWith('/ac_journeys')) return Response.json({ id, status: 'active' }); assert(u.pathname.endsWith('/ac_contacts')); assertEquals(u.searchParams.get('tenant_id'), `in.(${id})`); return Response.json([{ id, tenant_id: foreign }]); };
  try { const r = await h(request({ dry_run: true })); assertEquals(r.status, 200); assertEquals((await r.json()).enrolled, 0); } finally { globalThis.fetch = original; }
});
Deno.test('Auto enrollment validates active journey and assigned conversation tenant without writes in dry run', async () => {
  const h = await load('ac-segment-auto-enroll'), original = fetch; let reads = 0;
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r;
    assert(['GET', 'HEAD'].includes(init?.method ?? 'GET'));
    if (u.pathname.endsWith('/ac_journey_segments')) return Response.json([{ id, auto_enroll_journey_id: id }]);
    if (u.pathname.endsWith('/ac_journeys')) return Response.json({ id, status: 'active' });
    if (u.pathname.endsWith('/ac_contacts')) return Response.json([{ id, tenant_id: id }]);
    if (u.pathname.endsWith('/ac_conversations')) { assertEquals(u.searchParams.get('tenant_id'), `eq.${id}`); reads++; return new Response(null, { headers: { 'Content-Range': '*/3' } }); }
    if (u.pathname.endsWith('/ac_journey_runs')) return Response.json([]);
    throw new Error('Unexpected write or call');
  };
  try { const r = await h(request({ dry_run: true })); assertEquals(r.status, 200); assertEquals((await r.json()).enrolled, 1); assertEquals(reads, 1); } finally { globalThis.fetch = original; }
});