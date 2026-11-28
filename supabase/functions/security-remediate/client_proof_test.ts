import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.test('actual Release Control ignores client success fields and records only server-computed failed evidence', async () => {
  const originalServe = Deno.serve;
  const originalFetch = globalThis.fetch;
  for (const [key,value] of Object.entries({ SUPABASE_URL: 'https://proof-fixture.example.test', SUPABASE_ANON_KEY: 'public-fixture', SUPABASE_SERVICE_ROLE_KEY: 'private-fixture', PRODUCT_HUB_API_KEY: 'fixture-product-key' })) Deno.env.set(key,value);
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const recorded: Record<string,unknown>[] = [];
  Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: (callback: typeof handler) => { handler = callback; return { finished: Promise.resolve() }; } });
  globalThis.fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    let data: unknown;
    if (url.includes('/auth/v1/user')) data = { id: '00000000-0000-0000-0000-000000000123' };
    else if (url.includes('/user_profiles')) data = { account_status: 'active', invitation_status: 'accepted', password_reset_required: false };
    else if (url.includes('/rpc/ph2_release_admin')) data = true;
    else if (url.includes('/rpc/ph2_release_context')) data = 'server-context';
    else if (url.includes('/rpc/ph2_record_release_proof')) { recorded.push(JSON.parse(String(init?.body))); data = { passed: false }; }
    else if (url.includes('/product-hub-api/bundle')) data = { contract: 'invalid', products: [], offline_products: [] };
    else throw new Error('Unexpected request: fixture only');
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  };
  try {
    await import('../ph-release-control/index.ts');
    const callback = handler as ((req: Request) => Promise<Response>) | undefined;
    assert(callback);
    const response = await callback(new Request('https://proof-fixture.example.test', { method: 'POST', headers: { Authorization: 'Bearer fixture-super-admin' }, body: JSON.stringify({ action: 'bundle_check', channel: 'de', passed: true, _actor: 'attacker', details: { complete: true, context: 'attacker-context' } }) }));
    assertEquals(response.status, 200);
    assertEquals((await response.json()).passed, false);
    assertEquals(recorded.length, 1);
    assertEquals(recorded[0]._passed, false);
    assertEquals(recorded[0]._actor, '00000000-0000-0000-0000-000000000123');
    assertEquals((recorded[0]._details as Record<string,unknown>).context, 'server-context');
  } finally {
    Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: originalServe });
    globalThis.fetch = originalFetch;
  }
});