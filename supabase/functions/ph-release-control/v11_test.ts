import { assert, assertEquals } from 'jsr:@std/assert@1';
import { manifestPreflight, evaluateApex } from './v11.ts';
const apex = { alix_product_id: 'Apex', slug: 'alix-apex', sync_allowed: false };
const local = { id: 'local-apex', alix_product_id: 'Apex', slug: 'alix-apex' };
const bundle = () => ({ channel: 'de', contract: '1.3', products: [apex], offline_products: [{ alix_product_id: 'other', slug: 'other', sync_allowed: false }], sync_scope: { emergency_stopped: true } });
Deno.test('manifest count mismatch fails even without a production comparison', () => {
  assert(!manifestPreflight({ counts: { ph_products: 44 } }, { ph_products: [local] }, []).passed);
});
Deno.test('manifest preflight is independent from later production changes', () => {
  assert(manifestPreflight({ counts: { ph_products: 1 } }, { ph_products: [local] }, []).passed);
});
Deno.test('Apex dry run cannot pass without receiver scope confirmation', () => {
  const r = evaluateApex(bundle(), local, 'de'); assert(!r.passed); assertEquals(r.excluded, ['other']);
});
Deno.test('COM evidence cannot satisfy DE pilot', () => { const b = bundle(); b.channel = 'com'; assert(!evaluateApex(b, local, 'de', true).passed); });
Deno.test('notstop forbids all sync_allowed products', () => {
  const b = bundle(); b.products = [{ ...apex, sync_allowed: true }]; assert(!evaluateApex(b, local, 'de', true).passed);
});
Deno.test('only slug alix-apex and matching external identity qualify', () => { assert(!evaluateApex(bundle(), { ...local, alix_product_id: 'different' }, 'de', true).passed); });
Deno.test('duplicate Apex is rejected', () => { const b = bundle(); b.products.push(apex); assert(!evaluateApex(b, local, 'de', true).passed); });
Deno.test('corrupt restore parts never qualify', () => { assert(!manifestPreflight({ counts: { ph_products: 1 } }, { ph_products: [local] }, ['part.ndjson']).passed); });