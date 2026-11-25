import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { confirmedCardPaths, inspectComCards, readComCard } from './com-card-contract.ts';
const receipt = { ok: true, channel: 'de', hub_id: 'hub', product_id: 'de-id', status: 'OFFLINE', offline: true, public_urls: ['https://alix-lasers.de/produkte/alix-luxe'] };
const catalog = (slugs: string[], count = slugs.length) => `<main data-de-ssr-page><h1>Systeme</h1><section><p role="status">${count} Systeme insgesamt</p>${slugs.map(slug => `<a href="/produkte/${slug}"><img src="/device.webp"><span class="font-display">${slug}</span></a>`).join('')}</section></main>`;
Deno.test('DE requires its own confirmed identity and host', () => {
  assertEquals(confirmedCardPaths(receipt, 'hub', 'de-id', 'de'), ['/produkte/alix-luxe']);
  assertEquals(confirmedCardPaths(receipt, 'hub', 'com-id', 'de'), []);
  assertEquals(confirmedCardPaths({ ...receipt, channel: 'com' }, 'hub', 'de-id', 'de'), []);
  assertEquals(confirmedCardPaths({ ...receipt, public_urls: ['https://www.alix-lasers.com/devices/alix-luxe'] }, 'hub', 'de-id', 'de'), []);
});
Deno.test('DE visible cards are detected in the full catalog, not just the featured subset', () => {
  assertEquals(inspectComCards(catalog(['alix-revita', 'alix-luxe']), ['/produkte/alix-luxe'], 'de').state, 'visible');
});
Deno.test('DE empty, truncated or non-rendered catalogs cannot prove absence', () => {
  for (const html of [catalog([]), catalog(['alix-revita'], 19), '<main><h1>Denied</h1></main>']) {
    assertEquals(inspectComCards(html, ['/produkte/alix-luxe'], 'de').state, 'unknown');
  }
});
Deno.test('DE confirms absence only after two full read-only responses', async () => {
  let reads = 0;
  const check = await readComCard(['/produkte/alix-luxe'], async () => { reads++; return catalog(['alix-revita']); }, async () => {}, 'de');
  assertEquals(check.state, 'removed');
  assertEquals(reads, 2);
});
Deno.test('DE missing mapping causes no public request', async () => {
  let reads = 0;
  const check = await readComCard([], async () => { reads++; return catalog(['alix-revita']); }, async () => {}, 'de');
  assertEquals(check.state, 'unknown');
  assertEquals(reads, 0);
});
Deno.test('DE SEO and featured links cannot create a false visible card', () => {
  const html = catalog(['alix-revita']).replace('</main>', '<section><a href="/produkte/alix-luxe"><img><h2>Luxe</h2></a></section><script>alix-luxe</script></main>');
  assertEquals(inspectComCards(html, ['/produkte/alix-luxe'], 'de').state, 'removed');
});
