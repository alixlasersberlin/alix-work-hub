import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { deliverSignal, isolatedReceiver, receiptResult } from './ph-delivery.ts';
import { verify, type ChangeSignal } from './ph-signal.ts';
Deno.test('isolated HTTP: signal, product fetch, application, receipt and confirmation', async () => {
  const secret = 'isolated-http-fixture-not-a-production-secret';
  let signal: ChangeSignal, applied = 'unknown', reads = 0;
  const durations: number[] = [];
  const callback = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen: () => {} }, async req => {
    const raw = await req.text();
    const verified = await verify(secret, req.headers.get('x-alixwork-timestamp'), req.headers.get('x-alixwork-signature'), raw);
    assertEquals(verified.ok, true);
    applied = receiptResult(signal, JSON.parse(raw), signal.version, true);
    return Response.json({ status: applied });
  });
  const cbUrl = `http://127.0.0.1:${callback.addr.port}`;
  const products = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen: () => {} }, () => {
    reads++;
    return Response.json({ state: signal.desired, url: signal.desired === 'ONLINE' ? 'https://alix-lasers.de/devices/isolated' : null });
  });
  const productUrl = `http://127.0.0.1:${products.addr.port}`;
  const receiver = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen: () => {} }, async req => isolatedReceiver(await req.text(), req.headers, secret,
    async () => (await fetch(productUrl)).json(), async (raw, headers) => { const r = await fetch(cbUrl, { method: 'POST', headers, body: raw }); await r.body?.cancel(); }));
  try {
    const transport = ((_url, init) => fetch(`http://127.0.0.1:${receiver.addr.port}`, init)) as typeof fetch;
    for (let i=0; i<10; i++) {
      signal = { event: 'product.changed', event_id: crypto.randomUUID(), product_id: 'isolated', channel: 'de',
        version: new Date(Date.now()+i).toISOString(), desired: i%2 ? 'OFFLINE' : 'ONLINE', issued_at: new Date().toISOString() };
      const start = performance.now();
      assertEquals((await deliverSignal(signal, secret, transport)).ok, true);
      assertEquals(applied, 'website_confirmed');
      durations.push(Math.round((performance.now()-start)*100)/100);
    }
    assertEquals(reads, 10);
    assert(durations.every(n => n < 5000));
    console.log('Isolated local HTTP round trip milliseconds:', JSON.stringify({ runs: 10, min: Math.min(...durations), max: Math.max(...durations), mean: +(durations.reduce((a,b)=>a+b,0)/10).toFixed(2) }));
  } finally { await receiver.shutdown(); await products.shutdown(); await callback.shutdown(); }
});