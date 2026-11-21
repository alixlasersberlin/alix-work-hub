import { describe, expect, it } from 'vitest';
import { publishAllProducts, type BulkResult, type BulkPublishPorts } from './bulkPublish';

function setup() {
  const updates: Record<string, unknown>[] = [];
  const pushes: string[] = [];
  const results: BulkResult[] = [];
  const ports: BulkPublishPorts = {
    updateProduct: async (id, patch) => { updates.push({ id, ...patch }); },
    updateChannel: async () => {},
    pushGlobal: async id => { pushes.push(id); },
  };
  return { updates, pushes, results, ports, progress: (_: number, r: BulkResult) => results.push(r) };
}
const products = [{ id: 'a', name: 'Gerät A' }, { id: 'b', name: 'Gerät B' }];
describe('Abgleich All', () => {
  it('Beauty uses the protected direct sender without substituting a COM or DE identity', async () => {
    const s = setup();
    const channels: string[] = [];
    s.ports.pushGlobal = async (id, channel) => { s.pushes.push(id); channels.push(channel); };
    await publishAllProducts(products, [{ code: 'beautyco', name: 'Beauty', is_active: true }, { code: 'us', name: 'US', is_active: true }, { code: 'usa', name: 'USA', is_active: true }], [], s.ports, s.progress);
    expect(s.pushes).toEqual(['a', 'b']);
    expect(channels).toEqual(['beautyco', 'beautyco']);
    expect(s.results.map(r => r.state)).toEqual(['accepted', 'accepted']);
    expect(s.updates.some(p => 'active_de' in p || 'active_usa' in p)).toBe(false);
  });
  it('releases every product to active websites, not inactive ones', async () => {
    const s = setup();
    await publishAllProducts(products, [{ code: 'at', name: 'AT', is_active: true }, { code: 'dubai', name: 'AE', is_active: false }], [], s.ports, s.progress);
    expect(s.updates).toEqual([{ id: 'a', status: 'published', active_at: true }, { id: 'b', status: 'published', active_at: true }]);
    expect(s.results.map(r => r.state)).toEqual(['available', 'available']);
  });
  it('AE requires its own confirmed mapping, never COM/DE identities', async () => {
    const s = setup(); const channels: string[] = [];
    s.ports.pushGlobal = async (id, channel) => { s.pushes.push(id); channels.push(channel); };
    await publishAllProducts(products, [{ code: 'dubai', name: 'AE', is_active: true }], [
      { product_id: 'a', site_code: 'dubai', remote_product_id: 'ae-a', verified_at: '2026-11-21' },
      { product_id: 'b', site_code: 'com', remote_product_id: 'com-b', verified_at: '2026-11-21' },
    ], s.ports, s.progress);
    expect(s.pushes).toEqual(['a']); expect(channels).toEqual(['dubai']);
    expect(s.results.map(r => r.state)).toEqual(['accepted', 'skipped']);
    expect(s.updates).toEqual([{ id: 'a', status: 'published', active_dubai: true }]);
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
    s.ports.pushGlobal = async id => { s.pushes.push(id); throw new Error('Übertragung abgelehnt'); };
    await publishAllProducts(products, [{ code: 'com', name: 'COM', is_active: true }], products.map(p => ({ product_id: p.id, site_code: 'com', remote_product_id: p.id, verified_at: '2026-10-29' })), s.ports, s.progress);
    expect(s.pushes).toEqual(['a', 'b']);
    expect(s.results.map(r => r.state)).toEqual(['error', 'error']);
    expect(s.updates.every(p => !('price_status' in p) && !('price_public' in p) && !('approval_status' in p))).toBe(true);
  });
  it('sends DE to GLOBAL only with its own confirmed mapping, never the COM identity', async () => {
    const s = setup();
    const channels: string[] = [];
    s.ports.pushGlobal = async (id, channel) => { s.pushes.push(id); channels.push(channel); };
    await publishAllProducts(products, [{ code: 'de', name: 'DE', is_active: true }], [
      { product_id: 'a', site_code: 'de', remote_product_id: 'de-a', verified_at: '2026-11-21' },
      { product_id: 'b', site_code: 'com', remote_product_id: 'com-b', verified_at: '2026-11-21' },
    ], s.ports, s.progress);
    expect(s.pushes).toEqual(['a']);
    expect(channels).toEqual(['de']);
    expect(s.results.map(r => r.state)).toEqual(['accepted', 'skipped']);
  });
});