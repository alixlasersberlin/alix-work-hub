import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const names = ['ac-playbook-run', 'ac-journey-run', 'ac-alerts-check', 'ac-recording-retention', 'ac-wfm-adherence-alerts', 'maintenance-reminder-daily', 'delivery-approval-monthly-report', 'finance-asset-depreciation-run', 'offer-followup-engine', 'lager-bestand-notify'];
const machineOnly = ['ac-recording-retention', 'ac-wfm-adherence-alerts'];
const id = '00000000-0000-0000-0000-000000000001';
type Handler = (req: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();
function configure() {
  Deno.env.set('SUPABASE_URL', 'https://isolated-jobs-v4.example.test'); Deno.env.set('SUPABASE_ANON_KEY', 'public-jobs-v4');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-jobs-v4'); Deno.env.set('CRON_SECRET', 'private-jobs-v4');
}
async function load(name: string) {
  const old = handlers.get(name); if (old) return old;
  const original = Deno.serve; let captured: Handler | undefined;
  Deno.serve = ((handler: Handler) => { captured = handler; return {}; }) as typeof Deno.serve;
  try { await import(`../${name}/index.ts`); } finally { Deno.serve = original; }
  if (!captured) throw new Error(`Missing handler ${name}`); handlers.set(name, captured); return captured;
}
const request = (token: string, body: unknown = {}) => new Request('https://app.example.test', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
function identity(url: URL, active = true, member = true, role = 'Admin'): Response | null {
  if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id });
  if (url.pathname.endsWith('/user_profiles')) return Response.json({ is_active: active, account_status: active ? 'active' : 'disabled', invitation_status: 'accepted', password_reset_required: false });
  if (url.pathname.endsWith('/user_roles')) return Response.json([{ roles: { name: role } }]);
  if (url.pathname.endsWith('/user_tenant_access')) return Response.json(member ? [{ tenant_id: id }] : []);
  if (url.pathname.endsWith('/tenants')) return Response.json([{ id, code: 'DE' }]);
  return null;
}
const validBody = (name: string) => name === 'lager-bestand-notify' ? { serials: ['synthetic'] } : name === 'offer-followup-engine' ? { dryRun: true } : name === 'finance-asset-depreciation-run' ? { dry_run: true, period: '2026-11' } : {};
for (const name of names) {
  Deno.test(`v4 job ${name}: public and forged credentials cannot read, write or send`, async () => {
    configure(); const handler = await load(name); const original = fetch; let operations = 0;
    globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ message: 'invalid' }, { status: 401 }); operations++; throw new Error('Unauthorized operation'); };
    try { for (const token of ['', 'public-jobs-v4', 'forged']) { const r = await handler(request(token, validBody(name))); assertEquals(r.status, 401); await r.body?.cancel(); } assertEquals(operations, 0); }
    finally { globalThis.fetch = original; }
  });
  Deno.test(`v4 job ${name}: original machine credential retains isolated empty execution without external actions`, async () => {
    configure(); const handler = await load(name); const original = fetch; let operations = 0;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input)); assertEquals(url.hostname, 'isolated-jobs-v4.example.test');
      assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer service-jobs-v4'); operations++;
      return Response.json([]);
    };
    try { const r = await handler(request('private-jobs-v4', validBody(name))); assertEquals(r.status, name === 'lager-bestand-notify' ? 404 : 200); await r.body?.cancel(); assert(operations > 0); }
    finally { globalThis.fetch = original; }
  });
}
for (const name of names.filter(n => !machineOnly.includes(n))) {
  Deno.test(`v4 job ${name}: inactive, unassigned and unrelated human roles cannot run business operations`, async () => {
    configure(); const handler = await load(name); const original = fetch; let mode = 0;
    globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); const r = identity(url, mode !== 0, mode !== 1, mode === 2 ? 'Read Only' : 'Admin'); if (r) return r; throw new Error('Unauthorized operation'); };
    try { for (mode = 0; mode < 3; mode++) { const r = await handler(request('staff', validBody(name))); assertEquals(r.status, 403); await r.body?.cancel(); } }
    finally { globalThis.fetch = original; }
  });
  Deno.test(`v4 job ${name}: human business access retains personal row permissions`, async () => {
    configure(); const handler = await load(name); const original = fetch;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input)); assertEquals(url.hostname, 'isolated-jobs-v4.example.test'); const r = identity(url); if (r) return r;
      assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff'); assertEquals(init?.method ?? 'GET', 'GET'); return Response.json([]);
    };
    try { const r = await handler(request('staff', validBody(name))); assertEquals(r.status, name === 'lager-bestand-notify' ? 404 : 200); await r.body?.cancel(); }
    finally { globalThis.fetch = original; }
  });
}
Deno.test('v4 approval report cannot redirect configured recipients', async () => {
  configure(); const handler = await load('delivery-approval-monthly-report'); const original = fetch;
  globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); const r = identity(url); if (r) return r; assertEquals(url.pathname, '/rest/v1/app_settings'); return Response.json({ value: { monthlyReport: { enabled: true, recipients: ['approved@example.test'] } } }); };
  try { const r = await handler(request('staff', { force: true, recipients: ['redirect@example.test'] })); assertEquals(r.status, 400); await r.body?.cancel(); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4 depreciation rejects invalid months before reading financial data', async () => {
  configure(); const handler = await load('finance-asset-depreciation-run'); const original = fetch;
  globalThis.fetch = async input => { const url = new URL(String(input instanceof Request ? input.url : input)); const r = identity(url); if (r) return r; throw new Error('Invalid period reached finance'); };
  try { const r = await handler(request('staff', { period: '2026-13', dry_run: true })); assertEquals(r.status, 400); await r.body?.cancel(); }
  finally { globalThis.fetch = original; }
});
Deno.test('v4 journey dry run validates enrollment without storing or sending', async () => {
  configure(); const handler = await load('ac-journey-run'); const original = fetch; let reads = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input)); assertEquals(url.hostname, 'isolated-jobs-v4.example.test'); const r = identity(url); if (r) return r;
    assertEquals(init?.method ?? 'GET', 'GET'); assertEquals(new Headers(init?.headers).get('authorization'), 'Bearer staff'); reads++;
    if (url.pathname.endsWith('/ac_contacts')) return Response.json({ id, tenant_id: id });
    if (url.pathname.endsWith('/ac_journeys')) return Response.json({ id }); return Response.json([]);
  };
  try { const r = await handler(request('staff', { dry_run: true, journey_id: id, enroll_contact_id: id })); assertEquals(r.status, 200); await r.body?.cancel(); assertEquals(reads, 3); }
  finally { globalThis.fetch = original; }
});