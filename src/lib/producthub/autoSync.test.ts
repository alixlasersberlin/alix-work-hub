import { describe, it, expect } from 'vitest';
import { autoSyncTargets } from './autoSync';
const sites = [{ code: 'com' }, { code: 'de' }, { code: 'at' }, { code: 'us' }, { code: 'dubai' }, { code: 'beautyco', is_active: false }];
describe('autoSyncTargets', () => {
  it('sendet nur an aktivierte direkt angeschlossene Webseiten, nie US/AT', () => {
    expect(autoSyncTargets(c => c !== 'de', sites)).toEqual(['com', 'dubai']);
  });
  it('deaktivierte Webseiten erhalten keine Veröffentlichung', () => {
    expect(autoSyncTargets(() => false, sites)).toEqual([]);
  });
});
