import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildBeautyRelease, confirmedBeautyRelease, beautyReleaseEndpoint } from './beauty-release-contract.ts';
const request = buildBeautyRelease({ alix_product_id: 'ALIX-G15-PRO', updated_at: '2026-11-15T06:57:06.835382+00:00', price: 123 }, 'actor', 'publication', '2026-11-21T08:32:00Z');
const reply = { ok: true, online: true, dry_run: false, state: 'online', hub_id: request.hub_id, version: request.version, channel: 'beautyco', publication_id: request.publication_id, public_url: 'https://alix-beauty.com/beauty-geraete/alix-g15-pro', content_hash: 'a'.repeat(64) };
Deno.test('Beauty request uses only confirmed hub identity and exact microsecond version, never prices or content', () => {
  assertEquals(request.version, '2026-11-15T06:57:06.835382+00:00');
  assertEquals(request.hub_id, 'ALIX-G15-PRO');
  assertEquals(Object.keys(request).sort(), ['approval', 'channel', 'country', 'dry_run', 'hub_id', 'locale', 'publication_id', 'schema_version', 'target_origin', 'version']);
  assertEquals(beautyReleaseEndpoint, 'https://alix-beauty.com/api/public/product-hub/release');
  assertThrows(() => buildBeautyRelease({ updated_at: request.version }, 'actor', 'publication', 'date'));
});
Deno.test('Beauty only accepts matching ONLINE receipts; validation is not publication', () => {
  assertEquals(confirmedBeautyRelease(reply, request, false), true);
  const preview = { ...reply, state: 'validated', online: false, dry_run: true };
  assertEquals(confirmedBeautyRelease(preview, request, true), true);
  assertEquals(confirmedBeautyRelease(preview, request, false), false);
  for (const patch of [{ channel: 'de' }, { hub_id: 'another' }, { version: '2026-11-15T06:57:06.835+00:00' }, { publication_id: 'another' }, { content_hash: '' }, { public_url: 'https://alix-beauty.com.evil/beauty-geraete/alix-g15-pro' }, { public_url: 'https://alix-beauty.com/beauty-geraete/alix-g15-pro?redirect=evil' }]) assertEquals(confirmedBeautyRelease({ ...reply, ...patch }, request, false), false);
});