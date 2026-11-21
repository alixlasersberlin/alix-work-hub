import { expect, it, vi } from 'vitest';
import { controlDomain } from './domainControl';

const site = { code: 'de', name: 'alix-lasers.de', is_active: true };
const ports = () => ({ updateProduct: vi.fn(async () => {}), updateChannel: vi.fn(async () => ({ offline: true, note: 'OFFLINE', receipt: { status: 'OFFLINE' } })), pushGlobal: vi.fn(async () => {}) });
it('schaltet alle Artikel ausschließlich auf der gewählten Domain ab, auch bereits inaktive', async () => {
  const p = ports(); const results: any[] = [];
  await controlDomain([{ id: 'a', name: 'A', active_de: true }, { id: 'b', name: 'B', active_de: false }], site, 'deactivate', [], [], p, r => results.push(r));
  expect(p.updateProduct.mock.calls).toEqual([['a', { active_de: false }], ['b', { active_de: false }]]);
  expect(p.updateChannel).toHaveBeenCalledTimes(2);
  expect(p.updateChannel).toHaveBeenNthCalledWith(1, 'a', 'de', { hold: true, status: 'inactive', has_pending_changes: true });
  expect(p.updateChannel).toHaveBeenNthCalledWith(2, 'b', 'de', { hold: true, status: 'inactive', has_pending_changes: true });
  expect(results.map(r => r.receipt)).toEqual([{ status: 'OFFLINE' }, { status: 'OFFLINE' }]);
});
it('Abgleich folgt den Aktivflags und berücksichtigt Zurückhalten ohne andere Domains zu ändern', async () => {
  const p = ports(); const results: any[] = [];
  await controlDomain([{ id: 'a', name: 'A', active_de: true }, { id: 'b', name: 'B', active_de: true }], site, 'sync', [{ product_id: 'b', channel_code: 'de', hold: true }], [{ product_id: 'a', site_code: 'de', remote_product_id: 'remote-a', verified_at: '2026-11-21' }], p, r => results.push(r));
  expect(p.pushGlobal).toHaveBeenCalledExactlyOnceWith('a', 'de');
  expect(results.map(r => r.active)).toEqual([true, false]);
  expect(p.updateProduct).toHaveBeenCalledWith('b', { active_de: false });
});
it('US darf weder global aktiviert noch deaktiviert werden', async () => {
  const p = ports();
  await expect(controlDomain([{ id: 'a', name: 'A' }], { ...site, code: 'us' }, 'deactivate', [], [], p, () => {})).rejects.toThrow('US');
  expect(p.updateProduct).not.toHaveBeenCalled();
});
it('fehlende Zuordnung und Abschaltsperren bleiben bei Aktivierung gesperrt', async () => {
  const p = ports(); const results: any[] = [];
  await controlDomain([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], site, 'activate', [{ product_id: 'b', channel_code: 'de', remote_snapshot: { global_offline: { status: 'OFFLINE' } } }], [], p, r => results.push(r));
  expect(results.every(r => !r.confirmed)).toBe(true);
  expect(results[0].note).toContain('Gerätezuordnung');
  expect(results[1].note).toContain('Reaktivierungsvertrag');
  expect(p.updateProduct).not.toHaveBeenCalled();
});