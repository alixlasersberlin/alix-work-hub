import { describe, expect, it } from 'vitest';
import { isSiteSelected, siteSelectionPatch } from './siteSelection';

describe('Geräte-Webseitenauswahl', () => {
  it('sendet nur an angehakte Standard- und eigene Webseiten', () => {
    const product = { active_com: true, active_de: false };
    const custom = { beauty: true, shop: false };
    expect(['com', 'de', 'beauty', 'shop'].filter(code => isSiteSelected(product, code, custom))).toEqual(['com', 'beauty']);
  });
  it('aktiviert beim Speichern ohne eine Veröffentlichung auszulösen', () => {
    expect(siteSelectionPatch(true, 'inactive')).toEqual({ status: 'draft', hold: false });
    expect(siteSelectionPatch(true, 'published')).toEqual({ status: 'published', hold: false });
  });
  it('deaktiviert abgewählte Webseiten', () => {
    expect(siteSelectionPatch(false, 'published')).toEqual({ status: 'inactive', hold: true });
  });
});