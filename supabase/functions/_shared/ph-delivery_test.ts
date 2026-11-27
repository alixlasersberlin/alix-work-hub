import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { deliverSignal, isolatedReceiver, liveAllowed, prepareSignal, receiptResult, retryAt } from './ph-delivery.ts';
import { verify, isStale, type ChangeSignal, type StatusReceipt } from './ph-signal.ts';
const signal: ChangeSignal = { event: 'product.changed', event_id: '00000000-0000-4000-8000-000000000001',
  product_id: 'isolated-device', channel: 'de', version: '2026-11-27T07:00:00.000001Z', desired: 'ONLINE', issued_at: '2026-11-27T07:00:00Z' };
const product = { status: 'published', active_de: true, alix_product_id: 'isolated-device', name: 'Test', slug: 'test', hero_image_url: 'https://example.invalid/a.jpg' };
const approval = { enabled: true, backup_verified: true, restore_verified: true, communication_verified: true, approved_by: 'admin' };
Deno.test('live gate requires explicit flag and every acceptance gate', () => {
  assertEquals(liveAllowed('false', approval), false);
  assertEquals(liveAllowed('true', approval), true);
  for (const gate of ['enabled', 'backup_verified', 'restore_verified', 'communication_verified', 'approved_by'])
    assertEquals(liveAllowed('true', { ...approval, [gate]: false }), false);
});
for (const field of ['name','long_description','short_description','sku','tech_specs','hero_image_url','videos','documents','categories','translations','seo','warranty','central_prices']) {
  Deno.test(`full product update: ${field} keeps a new event even when desired state is unchanged`, () => {
    const event = { ...signal, version: '2026-11-27T07:00:00.000002Z' };
    const prepared = prepareSignal(event, { ...product, [field]: field === 'hero_image_url' ? 'https://example.invalid/b.jpg' : 'changed' }, null);
    assertEquals(prepared.signal.version, event.version);
    assertEquals(prepared.signal.desired, 'ONLINE');
  });
}
Deno.test('image becoming private blocks publication', () => assertEquals(prepareSignal(signal, { ...product, hero_image_url: 'https://example.invalid/object/sign/a?token=x' }, null).signal.desired, 'OFFLINE'));
Deno.test('regulatory holds are never removed', () => assertEquals(prepareSignal(signal, product, { hold: true }).signal.desired, 'OFFLINE'));
Deno.test('microsecond ordering survives concurrent changes', () => assert(isStale(signal.version, '2026-11-27T07:00:00.000002Z')));
Deno.test('initial attempt plus exactly five retries', () => {
  assertEquals([1,2,3,4,5,6].map(n => retryAt(n, 1000)), [3000,11000,31000,121000,601000,null]);
});
Deno.test('connection interruption leaves a retryable error, never publication', async () => {
  const result = await deliverSignal(signal, 'isolated-test-key', (() => { throw new Error('disconnected'); }) as typeof fetch);
  assertEquals(result.ok, false); assertEquals(result.error, 'connection_failed_or_timeout');
});
Deno.test('redirects cannot exfiltrate signed requests', async () => {
  await deliverSignal(signal, 'test', ((_url, init) => { assertEquals(init?.redirect, 'error'); return Promise.resolve(new Response(null, { status: 302 })); }) as typeof fetch);
});
Deno.test('complete isolated signal → fetch → apply → signed receipt → confirmed display state', async () => {
  let reads = 0, displayed = 'unknown'; const key = 'isolated-test-only';
  const transport = (async (_url, init) => isolatedReceiver(String(init?.body), new Headers(init?.headers), key,
    async id => { assertEquals(id, signal.product_id); reads++; return { state: 'ONLINE', url: 'https://alix-lasers.de/devices/test' }; },
    async (raw, headers) => {
      assertEquals((await verify(key, headers.get('x-alixwork-timestamp'), headers.get('x-alixwork-signature'), raw)).ok, true);
      displayed = receiptResult(signal, JSON.parse(raw), signal.version, true);
    })) as typeof fetch;
  assertEquals((await deliverSignal(signal, key, transport)).ok, true);
  assertEquals(reads, 1); assertEquals(displayed, 'website_confirmed');
});
Deno.test('receipt rejects unsent, stale, wrong identity and missing online URL', () => {
  const r: StatusReceipt = { ...signal, state: 'ONLINE', public_url: 'https://alix-lasers.de/devices/test', error: null, error_code: null, observed_at: signal.issued_at };
  assertEquals(receiptResult(signal, r, signal.version, false), 'not_transmitted');
  assertEquals(receiptResult(signal, { ...r, event_id: crypto.randomUUID() }, signal.version, true), 'identity_mismatch');
  assertEquals(receiptResult(signal, r, '2026-11-27T07:00:01Z', true), 'stale');
  assertEquals(receiptResult(signal, { ...r, public_url: null }, signal.version, true), 'missing_public_url');
});