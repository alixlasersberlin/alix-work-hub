import { expect, it, vi } from 'vitest';
import { toggleProductSite } from './siteToggle';

const product = { id: 'article-a', name: 'Artikel A' };
function ports() {
  return { updateProduct: vi.fn(async () => {}), updateChannel: vi.fn(async () => {}), pushGlobal: vi.fn(async () => {}) };
}
it('DE deaktivieren schreibt nur DE und nutzt genau einen automatischen Abschaltpfad', async () => {
  const p = ports();
  await toggleProductSite(product, { code: 'de', name: 'DE', is_active: true }, false, undefined, [], p);
  expect(p.updateProduct).toHaveBeenCalledExactlyOnceWith('article-a', { active_de: false });
  expect(p.updateChannel).toHaveBeenCalledExactlyOnceWith('article-a', 'de', { has_pending_changes: true });
  expect(p.pushGlobal).not.toHaveBeenCalled();
});
it('DE aktivieren nutzt ausschließlich die vorhandene einzelne DE-Freigabe', async () => {
  const p = ports();
  await toggleProductSite(product, { code: 'de', name: 'DE', is_active: true }, true, undefined,
    [{ product_id: 'article-a', site_code: 'de', remote_product_id: 'de-a', verified_at: '2026-11-21' }], p);
  expect(p.updateProduct).toHaveBeenCalledExactlyOnceWith('article-a', { status: 'published', active_de: true });
  expect(p.pushGlobal).toHaveBeenCalledExactlyOnceWith('article-a', 'de');
});
it('bestätigte Abschaltung kann nicht durch den Schnellklick reaktiviert werden', async () => {
  const p = ports();
  await expect(toggleProductSite(product, { code: 'com', name: 'COM', is_active: true }, true,
    { remote_snapshot: { global_offline: { status: 'OFFLINE' } } }, [], p)).rejects.toThrow('Reaktivierungsvertrag');
  expect(p.updateProduct).not.toHaveBeenCalled();
  expect(p.updateChannel).not.toHaveBeenCalled();
});
it('US bleibt bei Aktivierung und Deaktivierung unverändert', async () => {
  const p = ports();
  for (const code of ['us', 'usa']) for (const active of [true, false]) {
    await expect(toggleProductSite(product, { code, name: code, is_active: true }, active, undefined, [], p)).rejects.toThrow('US');
  }
  expect(p.updateProduct).not.toHaveBeenCalled();
  expect(p.updateChannel).not.toHaveBeenCalled();
});
it('fehlende DE-Zuordnung lässt das Gerät unverändert', async () => {
  const p = ports();
  await expect(toggleProductSite(product, { code: 'de', name: 'DE', is_active: true }, true, undefined, [], p)).rejects.toThrow('Gerätezuordnung');
  expect(p.updateProduct).not.toHaveBeenCalled();
});