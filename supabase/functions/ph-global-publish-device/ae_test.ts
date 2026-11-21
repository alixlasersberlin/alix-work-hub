import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { sendAE } from './ae.ts';

function setup() {
  const product = { id: 'local', alix_product_id: 'hub', updated_at: '2026-11-21T08:52:00Z', active_dubai: false, status: 'published', hero_image_url: 'https://framerusercontent.com/images/device.png' };
  const translation = { status: 'approved', updated_at: product.updated_at, name: 'Device', short_description: 'Description', long_description: 'Full description' };
  const row = { hold: true, remote_snapshot: {} as Record<string, any> };
  const state = { role: true, active: true, map: { verified_at: '2026-11-21', remote_product_id: '00000000-0000-4000-8000-000000000001' } as any, claims: 0, finishes: [] as any[] };
  const builder = (data: unknown) => { const q: any = { select: () => q, eq: () => q, order: async () => ({ data, error: null }), maybeSingle: async () => ({ data, error: null }) }; return q; };
  const caller: any = { auth: { getUser: async () => ({ data: { user: { id: 'actor' } }, error: null }) }, rpc: async (name: string) => ({ data: name === 'has_role' ? state.role : true, error: null }), from: (name: string) => builder(name === 'ph_products' ? product : { is_active: state.active, account_status: 'active' }) };
  const admin: any = { from: (name: string) => builder(name === 'ph_lang_sync_map' ? state.map : name === 'ph_product_channels' ? row : name === 'ph_channels' ? { is_active: true } : name === 'ph_product_translations' ? translation : []), rpc: async (name: string, args: any) => {
    if (name === 'ph_ae_claim_operation') { state.claims++; row.remote_snapshot.ae_pending = args.p_envelope; }
    else { state.finishes.push(args); if (args.p_confirmed) { row.remote_snapshot.ae_direct = args.p_reply; delete row.remote_snapshot.ae_pending; } }
    return { error: null };
  } };
  const reply = (request: Record<string, any>) => new Response(JSON.stringify({ ok: true, hub_id: request.hub_id, product_id: request.product_id, channel: 'dubai', source_version: request.source_version, ...(request.action === 'publish' ? { publish_id: request.publish_id } : { operation_id: request.operation_id }),
    ...(request.dry_run ? { online: false, offline: false, dry_run: true, status: request.action === 'publish' ? 'WRITE_READY' : request.action === 'deactivate' ? 'OFFLINE_READY' : 'REACTIVATE_READY' } : { online: request.action !== 'deactivate', offline: request.action === 'deactivate', status: request.action === 'deactivate' ? 'OFFLINE' : 'ONLINE', public_url: 'https://alix-lasers.ae/systems/device', public_urls: ['https://alix-lasers.ae/systems/device', 'https://alix-lasers.ae/ar/systems/device'] }) }));
  return { product, row, state, caller, admin, reply };
}
Deno.test('AE flow signs only its fixed host, preserves operation/version and records exact OFFLINE', async () => {
  const s = setup(); const original = globalThis.fetch; const requests: any[] = [];
  globalThis.fetch = async (url, init) => { assertEquals(String(url), 'https://alix-lasers.ae/api/public/product-hub/direct-release'); assertEquals(init?.method, 'POST'); assertEquals(init?.redirect, 'manual'); const req = JSON.parse(String(init?.body)); requests.push(req); return s.reply(req); };
  try {
    const result = await sendAE(s.admin, s.caller, s.product, 'actor', 'synthetic-test-key', 'deactivate', false);
    assertEquals(result.offline, true); assertEquals(s.state.claims, 1); assertEquals(s.state.finishes[0].p_confirmed, true);
    assertEquals(requests.map(r => r.dry_run), [true, false]); assertEquals(requests[0].operation_id, requests[1].operation_id);
    assertEquals(s.row.remote_snapshot.ae_direct.product_id, s.state.map.remote_product_id);
    assertEquals('content' in requests[1], false);
  } finally { globalThis.fetch = original; }
});
Deno.test('AE mapping, role and account gates deny before remote access', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('{}'); };
  try {
    for (const variant of ['mapping', 'role', 'active']) {
      const s = setup(); if (variant === 'mapping') s.state.map.verified_at = null; else if (variant === 'role') s.state.role = false; else s.state.active = false;
      await assertRejects(() => sendAE(s.admin, s.caller, s.product, 'actor', 'synthetic-test-key', 'deactivate', false)); assertEquals(s.state.claims, 0);
    }
    assertEquals(calls, 0);
  } finally { globalThis.fetch = original; }
});
Deno.test('AE uncertain write stays reserved without retries; dry run never reserves', async () => {
  const s = setup(); const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async (_url, init) => { calls++; const request = JSON.parse(String(init?.body)); if (!request.dry_run) throw new Error('uncertain'); return s.reply(request); };
  try {
    assertEquals((await sendAE(s.admin, s.caller, s.product, 'actor', 'synthetic-test-key', 'deactivate', true)).online, false); assertEquals(s.state.claims, 0);
    assertEquals((await sendAE(s.admin, s.caller, s.product, 'actor', 'synthetic-test-key', 'deactivate', false)).ok, false);
    assertEquals(calls, 3); assertEquals(s.state.claims, 1); assertEquals(s.state.finishes.length, 0); assertEquals(!!s.row.remote_snapshot.ae_pending, true);
  } finally { globalThis.fetch = original; }
});
Deno.test('AE publish uses approved English, not German fallback, and requires matching ONLINE', async () => {
  const s = setup(); s.product.active_dubai = true; s.row.hold = false;
  const original = globalThis.fetch; const requests: any[] = [];
  globalThis.fetch = async (_url, init) => { const request = JSON.parse(String(init?.body)); requests.push(request); return s.reply(request); };
  try {
    assertEquals((await sendAE(s.admin, s.caller, s.product, 'actor', 'synthetic-test-key', 'publish', false)).online, true);
    assertEquals(requests[1].content.locale, 'en'); assertEquals(requests[1].content.fields[0].value, 'Device');
    assertEquals('price' in requests[1].content, false);
  } finally { globalThis.fetch = original; }
});