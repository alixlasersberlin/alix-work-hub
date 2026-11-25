import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { verifyComCard } from './com-card-check.ts';

const product = { id: 'local', alix_product_id: 'hub' };
const proof = { ok: true, offline: true, status: 'OFFLINE', channel: 'com', hub_id: 'hub', product_id: 'remote', operation_id: 'operation', public_urls: ['https://www.alix-lasers.com/devices/hifu-pro'] };

function database(verified: boolean) {
  const logs: Record<string, any>[] = [];
  const admin = { from: (table: string) => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'ph_lang_sync_map' ? { remote_product_id: 'remote', verified_at: verified ? '2026-11-25' : null } : { remote_snapshot: { global_offline: proof } }, error: null }) }) }) }),
    insert: async (row: Record<string, any>) => { logs.push(row); return { error: null }; },
  }) } as unknown as SupabaseClient;
  return { admin, logs };
}

Deno.test('missing verified mapping records an unknown result without a public fetch', async () => {
  const { admin, logs } = database(false);
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => { calls++; throw new Error('not allowed'); };
  try {
    const result = await verifyComCard(admin, product, proof, 'deactivate');
    assertEquals(result.state, 'unknown');
    assertEquals(calls, 0);
    assertEquals(logs.length, 1);
    assertEquals(logs[0].operation, 'com_card_check');
    assertEquals(logs[0].payload.trigger, 'deactivate');
    assertEquals(logs[0].payload.state, 'unknown');
  } finally { globalThis.fetch = original; }
});

Deno.test('manual verification is read-only and records visible cards separately from OFFLINE', async () => {
  const { admin, logs } = database(true);
  const original = globalThis.fetch;
  const methods: string[] = [];
  globalThis.fetch = (input, init) => {
    const url = new URL(String(input));
    assertEquals(url.origin + url.pathname, 'https://www.alix-lasers.com/devices');
    assertEquals(url.searchParams.has('_alixwork_check'), true);
    assertEquals(init?.redirect, 'manual');
    methods.push(init?.method ?? 'GET');
    return Promise.resolve(new Response('<html><body><main id="main-content"><h1>Devices</h1><p>1 devices</p><a href="/devices/hifu-pro"><img src="/hifu.png"><h2>Hifu Pro</h2></a></main></body></html>', { headers: { 'Content-Type': 'text/html' } }));
  };
  try {
    const result = await verifyComCard(admin, product, null, 'manual');
    assertEquals(result.state, 'visible');
    assertEquals(methods, ['GET', 'GET', 'GET']);
    assertEquals(logs[0].payload.operation_id, 'operation');
    assertEquals(logs[0].payload.trigger, 'manual');
    assertEquals(logs[0].status, 'warning');
    assertEquals(proof.offline, true);
  } finally { globalThis.fetch = original; }
});