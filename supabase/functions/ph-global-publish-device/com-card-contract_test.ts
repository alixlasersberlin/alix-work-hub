import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { confirmedCardPaths, inspectComCards, readComCard } from './com-card-contract.ts';

const receipt = { ok: true, offline: true, status: 'OFFLINE', channel: 'com', hub_id: 'hub', product_id: 'remote', public_urls: ['https://www.alix-lasers.com/devices/hifu-pro'] };
const card = (slug: string) => `<a href="/devices/${slug}"><img src="/device.png"><h2>Device</h2></a>`;
const catalog = (slugs: string[], count = slugs.length) => `<html><body><main id="main-content"><h1>Laser Systems &amp; Aesthetic Devices</h1><p>${count} devices</p>${slugs.map(card).join('')}</main></body></html>`;

Deno.test('COM absence requires a confirmed current hub and remote identity', () => {
  assertEquals(confirmedCardPaths(receipt, 'hub', 'remote'), ['/devices/hifu-pro']);
  assertEquals(confirmedCardPaths(receipt, 'other', 'remote'), []);
  assertEquals(confirmedCardPaths(receipt, 'hub', 'other'), []);
  assertEquals(confirmedCardPaths({ ...receipt, dry_run: true }, 'hub', 'remote'), []);
  assertEquals(confirmedCardPaths({ ...receipt, channel: 'de' }, 'hub', 'remote'), []);
});
Deno.test('untrusted URLs and catalog-only URLs never establish card identity', () => {
  for (const url of ['https://evil.example/devices/hifu-pro', 'https://www.alix-lasers.com/devices', 'http://www.alix-lasers.com/devices/hifu-pro', 'https://www.alix-lasers.com/devices/hifu-pro?category=facial']) {
    assertEquals(confirmedCardPaths({ ...receipt, public_urls: [url] }, 'hub', 'remote'), []);
  }
});
Deno.test('a real card with its exact receiver-confirmed link remains visible', () => {
  const result = inspectComCards(catalog(['hifu-pro', 'alix-revita']), ['/devices/hifu-pro']);
  assertEquals(result.state, 'visible');
  assertEquals(result.card_count, 2);
  assertEquals(result.matched_urls, ['https://www.alix-lasers.com/devices/hifu-pro']);
});
Deno.test('absence is only inferred from a complete catalog with matching card count', () => {
  assertEquals(inspectComCards(catalog(['alix-revita']), ['/devices/hifu-pro']).state, 'removed');
  assertEquals(inspectComCards(catalog(['alix-revita'], 2), ['/devices/hifu-pro']).state, 'unknown');
  assertEquals(inspectComCards(catalog([]), ['/devices/hifu-pro']).state, 'unknown');
  assertEquals(inspectComCards('<html><h1>Access denied</h1></html>', ['/devices/hifu-pro']).state, 'unknown');
});
Deno.test('script, footer and SEO references are not visible device cards', () => {
  const html = catalog(['alix-revita']) + `<script>${card('hifu-pro')}</script><footer>${card('hifu-pro')}</footer>`;
  assertEquals(inspectComCards(html, ['/devices/hifu-pro']).state, 'removed');
});
Deno.test('similar slugs never count as the target device', () => {
  assertEquals(inspectComCards(catalog(['hifu-pro-plus']), ['/devices/hifu-pro']).state, 'removed');
});
Deno.test('a check needs two consecutive complete absence reads', async () => {
  let reads = 0;
  const result = await readComCard(['/devices/hifu-pro'], async () => { reads++; return catalog(['alix-revita']); }, async () => {});
  assertEquals(result.state, 'removed');
  assertEquals(reads, 2);
});
Deno.test('stale visibility is rechecked without repeating any write', async () => {
  const pages = [catalog(['hifu-pro']), catalog(['alix-revita']), catalog(['alix-revita'])];
  const result = await readComCard(['/devices/hifu-pro'], async () => pages.shift() ?? '', async () => {});
  assertEquals(result.state, 'removed');
  assertEquals(result.attempts, 3);
});
Deno.test('continued card visibility is reported after the bounded read budget', async () => {
  let reads = 0;
  const result = await readComCard(['/devices/hifu-pro'], async () => { reads++; return catalog(['hifu-pro']); }, async () => {});
  assertEquals(result.state, 'visible');
  assertEquals(reads, 3);
});
Deno.test('unreachable page never confirms absence', async () => {
  const result = await readComCard(['/devices/hifu-pro'], async () => { throw new Error('timeout'); }, async () => {});
  assertEquals(result.state, 'unknown');
  assertEquals(result.attempts, 3);
});
Deno.test('missing card identity remains unknown without any external request', async () => {
  let reads = 0;
  const result = await readComCard([], async () => { reads++; return catalog(['alix-revita']); }, async () => {});
  assertEquals(result.state, 'unknown');
  assertEquals(reads, 0);
});
Deno.test('single final absence after failed reads is not enough', async () => {
  const pages = ['', '', catalog(['alix-revita'])];
  const result = await readComCard(['/devices/hifu-pro'], async () => pages.shift() ?? '', async () => {});
  assertEquals(result.state, 'unknown');
});