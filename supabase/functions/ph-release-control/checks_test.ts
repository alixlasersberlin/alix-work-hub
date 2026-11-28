import { assert, assertEquals } from 'jsr:@std/assert@1';
import { summarizeBundle, bundlePassed, evaluateRestore } from './checks.ts';
const p = (id: string, slug: string, media: any[] = []) => ({ alix_product_id: id, slug, sync_allowed: false, media, documents: [] });
Deno.test('media order does not break v1.2 compatibility', () => {
  const m1 = { url: 'a', kind: 'image' }, m2 = { url: 'b', kind: 'image' };
  const s = summarizeBundle({ contract: '1.3', products: [p('1', 'alix-apex', [m1, m2])], offline_products: [{ alix_product_id: '2', slug: 'x', state: 'offline' }] },
    { contract: '1.2', products: [p('1', 'alix-apex', [m2, m1])] }, 'alix-apex');
  assert(bundlePassed(s)); assertEquals(s.pilot.found, 'online'); assertEquals(s.offline, 1);
});
Deno.test('duplicate and overlap fail', () => {
  const s = summarizeBundle({ contract: '1.3', products: [p('1', 'a')], offline_products: [{ alix_product_id: '1', slug: 'a', state: 'offline' }] }, { contract: '1.2', products: [p('1', 'a')] }, 'a');
  assert(!bundlePassed(s)); assertEquals(s.overlap, ['1']); assertEquals(s.pilot.found, 'online');
});
Deno.test('content change fails compatibility', () => {
  const s = summarizeBundle({ contract: '1.3', products: [{ ...p('1', 'a'), name: 'X' }], offline_products: [] }, { contract: '1.2', products: [{ ...p('1', 'a'), name: 'Y' }] }, 'a');
  assert(!s.compatible_v12);
});
const base = () => {
  const prod = { id: 'p', created_at: '2026-01-01', updated_at: '2026-01-01', name: 'A' };
  const tables: Record<string, any[]> = { ph_products: [prod], ph_media: [{ id: 'm', product_id: 'p', created_at: '2026-01-01' }], ph_documents: [], ph_product_channels: [], ph_channels: [], ph_settings: [] };
  return { backupCreatedAt: '2026-06-01', restored: structuredClone(tables), live: structuredClone(tables), hashFailures: [] as string[] };
};
Deno.test('identical restore passes', () => assert(evaluateRestore(base()).passed));
Deno.test('hash failure fails', () => { const b = base(); b.hashFailures = ['x']; assert(!evaluateRestore(b).passed); });
Deno.test('row missing in backup fails, row edited after backup is tolerated', () => {
  const b = base(); b.live.ph_products.push({ id: 'q', created_at: '2026-02-01', updated_at: '2026-02-01' });
  assert(!evaluateRestore(b).passed);
  const c = base(); c.live.ph_products[0] = { ...c.live.ph_products[0], name: 'B', updated_at: '2026-07-01' };
  assert(evaluateRestore(c).passed);
});
Deno.test('orphan media fails', () => { const b = base(); b.restored.ph_media[0].product_id = 'zz'; assert(!evaluateRestore(b).passed); });
Deno.test('missing table fails', () => { const b = base(); delete b.restored.ph_settings; assert(!evaluateRestore(b).passed); });
