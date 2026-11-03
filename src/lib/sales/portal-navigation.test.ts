import { describe, it, expect } from 'vitest';
import { safeSalesReturn, isSalesPortalPath } from './portal-navigation';

describe('sales portal return destination', () => {
  it('preserves direct lead links and filters after login', () => {
    expect(safeSalesReturn('/meine-leads/akte/123?ansicht=neu')).toBe('/meine-leads/akte/123?ansicht=neu');
    expect(safeSalesReturn('/meine-leads')).toBe('/meine-leads');
  });
  it('rejects external and disguised destinations', () => {
    for (const target of ['https://evil.test/meine-leads', '//evil.test/meine-leads', '/\\evil.test', '/meine-leads/../../dashboard', '/meine-leads-evil', '/dashboard']) {
      expect(safeSalesReturn(target)).toBeNull();
    }
  });
  it('leaves existing internal workspaces outside the portal', () => {
    expect(isSalesPortalPath('/vertrieb/meine-leads')).toBe(false);
    expect(isSalesPortalPath('/meine-leads/angebot')).toBe(true);
  });
});