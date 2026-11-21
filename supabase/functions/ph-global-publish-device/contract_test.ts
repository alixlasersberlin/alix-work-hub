import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildContent, confirmedReply, endpoints, mediaAllowed, signedHeaders, versionFor } from './contract.ts';
const product = { name: 'Hifu Pro', short_description: 'Hautstraffung', long_description: 'Originaltext', hero_image_url: 'https://dxbrovbbwrtdsimdnrpy.supabase.co/storage/v1/object/public/device-images/hifu.png', power: '1600 W', price: 9900, price_public: true };
Deno.test('DE uses original texts and excludes all prices', () => {
  const content = buildContent(product, null, 'de', []);
  assertEquals(content.locale, 'de');
  assertEquals(content.fields[0].value, 'Hifu Pro');
  assertEquals(content.technical, { power: '1600 W' });
  assertEquals(JSON.stringify(content).includes('9900'), false);
  assertEquals(JSON.stringify(content).includes('price'), false);
});
Deno.test('COM requires approved English, never German fallback', () => {
  assertThrows(() => buildContent(product, null, 'com', []));
  assertThrows(() => buildContent(product, { ...product, status: 'review' }, 'com', []));
  assertEquals(buildContent(product, { ...product, status: 'approved', short_description: 'Skin tightening' }, 'com', []).fields[1].value, 'Skin tightening');
});
Deno.test('rejects price text and private or unapproved image URLs', () => {
  assertThrows(() => buildContent({ ...product, short_description: 'Angebot 9900 EUR' }, null, 'de', []));
  assertEquals(mediaAllowed('https://evil.example/image.png'), false);
  assertEquals(mediaAllowed(product.hero_image_url + '?token=private'), false);
});
Deno.test('dry run and receipt alone never confirm online; identity must match', () => {
  const release = { publish_id: 'release', product_id: 'device', hub_id: 'hub', source_version: 'v1', channel: 'de' };
  const reply = { ...release, ok: true, online: true, status: 'ONLINE', public_url: 'https://alix-lasers.de/produkte/hifu-pro' };
  assertEquals(confirmedReply(reply, release, false), true);
  assertEquals(confirmedReply({ ...reply, status: 'WRITE_READY', online: false }, release, false), false);
  assertEquals(confirmedReply({ ...reply, channel: 'com' }, release, false), false);
  assertEquals(confirmedReply({ ...reply, product_id: 'other' }, release, false), false);
  assertEquals(confirmedReply({ ...reply, public_url: 'https://evil.example/' }, release, false), false);
});
Deno.test('signature binds exact timestamp and body and fixed endpoints', async () => {
  const headers = await signedHeaders('synthetic-test-only', '{"channel":"de"}', '1795232580');
  assertEquals(headers['x-alixwork-timestamp'], '1795232580');
  const changed = await signedHeaders('synthetic-test-only', '{"channel":"com"}', '1795232580');
  assertEquals(headers['x-alixwork-signature'] === changed['x-alixwork-signature'], false);
  assertEquals(endpoints.de, 'https://alix-lasers.de/api/public/product-hub/direct-release');
  assertEquals(endpoints.com, 'https://www.alix-lasers.com/api/public/product-hub/direct-release');
  assertEquals(await versionFor({ a: 1 }) === await versionFor({ a: 2 }), false);
});