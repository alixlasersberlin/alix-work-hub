import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createShopifyClient, ShopifyError } from './client.ts';

Deno.test('Client-Credentials-Grant uses the required shop endpoint and form parameters', async () => {
  let calls = 0;
  const client = createShopifyClient('fixture-id', 'fixture-secret', async (url, init) => {
    calls++;
    if (calls === 1) {
      assertEquals(String(url), 'https://0213c2-4.myshopify.com/admin/oauth/access_token');
      assertEquals((init?.body as URLSearchParams).get('grant_type'), 'client_credentials');
      assertEquals((init?.body as URLSearchParams).get('client_id'), 'fixture-id');
      assertEquals((init?.body as URLSearchParams).get('client_secret'), 'fixture-secret');
      return Response.json({ access_token: 'fixture-token', expires_in: 86400, scope: 'read_orders,read_all_orders' });
    }
    assertEquals(new Headers(init?.headers).get('X-Shopify-Access-Token'), 'fixture-token');
    return Response.json({ data: { shop: { name: 'Fixture' } } });
  });
  await client.graphql('{ shop { name } }');
  assertEquals(client.scopes(), ['read_orders', 'read_all_orders']);
});

Deno.test('Token is reused and refreshed before the provider expiry', async () => {
  let now = 0; let issued = 0;
  const client = createShopifyClient('fixture', 'fixture', async url => {
    if (String(url).endsWith('/access_token')) { issued++; return Response.json({ access_token: 'fixture', expires_in: 86400 }); }
    return Response.json({ data: {} });
  }, () => now);
  await client.graphql('{}'); await client.graphql('{}');
  assertEquals(issued, 1);
  now = 86340 * 1000;
  await client.graphql('{}');
  assertEquals(issued, 2);
});

Deno.test('Rejected credentials never expose the provider token response', async () => {
  const client = createShopifyClient('fixture', 'fixture', async () => new Response('sensitive-fixture', { status: 401 }));
  const error = await assertRejects(() => client.graphql('{}'), ShopifyError);
  assertEquals(error.message.includes('sensitive-fixture'), false);
});