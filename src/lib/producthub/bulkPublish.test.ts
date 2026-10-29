import { describe, expect, it } from 'vitest';
import { publishAllProducts, type BulkResult, type BulkPublishPorts } from './bulkPublish';

function setup() {
  const updates: Record<string, unknown>[] = [];
  const pushes: string[] = [];
  const results: BulkResult[] = [];
  const ports: BulkPublishPorts = {
    updateProduct: async (id, patch) => { updates.push({ id, ...patch }); },
    updateChannel: async () => {},
    pushCom: async id => { pushes.push(id); },
  };
  return { updates, pushes, results, ports, progress: (_: number, r: BulkResult) => results.push(r) };
}
const products = [{ id: 'a', name: 'Gerät A' }, { id: 'b', name: 'Gerät B' }];
describe('Abgleich All', () => {
  it('releases every product to active websites, not inactive ones', async () => {
    const s = setup();
    await publishAllProducts(products, [{ code: 'de', name: 'DE', is_active: true }, { code: 'at', name: 'AT', is_active: false }], [], s.ports, s.progress);
    expect(s.updates).toEqual([{ id: 'a', status: 'published', active_de: true }, { id: 'b', status: 'published', active_de: true }]);
    expect(s.results.map(r => r.state)).toEqual(['available', 'available']);
  });
  it('pushes COM only with confirmed product mapping', async () => {
    const s = setup();
    await publishAllProducts(products, [{ code: 'com', name: 'COM', is_active: true }], [
      { product_id: 'a', site_code: 'com', remote_product_id: 'device-a', verified_at: '2026-10-29' },
      { product_id: 'b', site_code: 'com', remote_product_id: 'device-b', verified_at: null },
    ], s.ports, s.progress);
    expect(s.pushes).toEqual(['a']);
    expect(s.results.map(r => r.state)).toEqual(['accepted', 'skipped']);
  });
  it('does not report failed sends as accepted and continues without retry', async () => {
    const s = setup();
    s.ports.pushCom = async id => { s.pushes.push(id); throw new Error('Übertragung abgelehnt'); };
    await publishAllProducts(products, [{ code: 'com', name: 'COM', is_active: true }], products.map(p => ({ product_id: p.id, site_code: 'com', remote_product_id: p.id, verified_at: '2026-10-29' })), s.ports, s.progress);
    expect(s.pushes).toEqual(['a', 'b']);
    expect(s.results.map(r => r.state)).toEqual(['error', 'error']);
    expect(s.updates.every(p => !('price_status' in p) && !('price_public' in p) && !('approval_status' in p))).toBe(true);
  });
});