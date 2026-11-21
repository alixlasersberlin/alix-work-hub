import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { publishBeauty } from './beauty-release.ts';

function setup() {
  const product = { id: 'product', alix_product_id: 'ALIX-G15-PRO', updated_at: '2026-11-15T06:57:06.835382+00:00', active_de: true, status: 'published', tenant_id: null };
  const state = { hold: false, status: 'published', remote_snapshot: {} as Record<string, any>, active: true, role: true, requests: [] as Record<string, any>[], claims: 0, finishes: [] as any[] };
  const builder = (data: unknown) => { const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data, error: null }) }; return q; };
  const caller: any = {
    auth: { getUser: async () => ({ data: { user: { id: 'actor' } }, error: null }) },
    rpc: async (name: string) => ({ data: name === 'has_role' ? state.role : true, error: null }),
    from: (name: string) => builder(name === 'ph_products' ? product : { is_active: state.active, account_status: 'active' }),
  };
  const admin: any = {
    from: (name: string) => builder(name === 'ph_channels' ? { is_active: true } : state),
    rpc: async (name: string, args: any) => {
      if (name === 'ph_beauty_claim_release') { state.claims++; state.remote_snapshot.beauty_pending = args.p_request; }
      else { state.finishes.push(args); if (args.p_online) { state.remote_snapshot.beauty_online = args.p_reply; delete state.remote_snapshot.beauty_pending; } }
      return { error: null };
    },
  };
  const response = (request: Record<string, any>) => new Response(JSON.stringify({ ok: true, online: !request.dry_run, dry_run: request.dry_run, state: request.dry_run ? 'validated' : 'online', hub_id: request.hub_id, version: request.version, publication_id: request.publication_id, channel: 'beautyco', public_url: 'https://alix-beauty.com/beauty-geraete/alix-g15-pro', content_hash: 'a'.repeat(64) }));
  return { product, state, caller, admin, response };
}

Deno.test('Beauty signed flow validates, reserves once, publishes and stores exact online proof without prices', async () => {
  const s = setup(); const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assertEquals(String(url), 'https://alix-beauty.com/api/public/product-hub/release');
    assertEquals(init?.method, 'PATCH'); assertEquals(init?.redirect, 'manual');
    const headers = new Headers(init?.headers);
    assertEquals(headers.get('x-api-key'), 'synthetic-test-key');
    assertEquals(headers.get('x-alix-signature')?.startsWith('sha256='), true);
    const body = JSON.parse(String(init?.body)); s.state.requests.push(body); return s.response(body);
  };
  try {
    const result = await publishBeauty(s.admin, s.caller, s.product, 'actor', 'synthetic-test-key', false);
    assertEquals(result.online, true); assertEquals(s.state.claims, 1); assertEquals(s.state.finishes.length, 1);
    assertEquals(s.state.requests.map(r => r.dry_run), [true, false]);
    assertEquals(s.state.requests[0].publication_id, s.state.requests[1].publication_id);
    assertEquals(s.state.remote_snapshot.beauty_online.version, s.product.updated_at);
    assertEquals('price' in s.state.requests[1], false);
  } finally { globalThis.fetch = original; }
});
Deno.test('Beauty denies non-admin, inactive, withheld and offline/pending states before any remote call', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('{}'); };
  try {
    for (const variant of ['role', 'active', 'hold', 'beauty_pending', 'beauty_offline', 'beauty_offline_pending']) {
      const s = setup();
      if (variant === 'role') s.state.role = false;
      else if (variant === 'active') s.state.active = false;
      else if (variant === 'hold') s.state.hold = true;
      else s.state.remote_snapshot[variant] = {};
      await assertRejects(() => publishBeauty(s.admin, s.caller, s.product, 'actor', 'synthetic-test-key', false));
      assertEquals(s.state.claims, 0);
    }
    assertEquals(calls, 0);
  } finally { globalThis.fetch = original; }
});
Deno.test('Beauty dry-run writes nothing and uncertain sends remain reserved without retries', async () => {
  const original = globalThis.fetch;
  try {
    const s = setup(); let calls = 0;
    globalThis.fetch = async (_url, init) => { calls++; const request = JSON.parse(String(init?.body)); if (!request.dry_run) throw new Error('uncertain'); return s.response(request); };
    assertEquals((await publishBeauty(s.admin, s.caller, s.product, 'actor', 'synthetic-test-key', true)).online, false);
    assertEquals(s.state.claims, 0);
    assertEquals((await publishBeauty(s.admin, s.caller, s.product, 'actor', 'synthetic-test-key', false)).online, false);
    assertEquals(calls, 3); assertEquals(s.state.claims, 1); assertEquals(s.state.finishes.length, 0);
    assertEquals(!!s.state.remote_snapshot.beauty_pending, true);
  } finally { globalThis.fetch = original; }
});