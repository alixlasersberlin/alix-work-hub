import { describe, expect, it } from 'vitest';
import { navItems, type NavChild } from './navItems';

function reachablePaths(items: NavChild[], roles: string[]): string[] {
  return items
    .filter(item => !item.roles || item.roles.some(role => roles.includes(role)))
    .flatMap(item => item.children ? reachablePaths(item.children, roles) : [item.path]);
}

describe('Angebotsersteller navigation through all ancestors', () => {
  const paths = reachablePaths(navItems, ['Angebotsersteller']);

  it('allows Sanae to reach the offer list', () => {
    expect(paths).toContain('/verkauf/angebote');
  });

  it('allows Sanae to reach offer creation', () => {
    expect(paths).toContain('/verkauf/angebot/neu');
  });

  it('does not open customers or orders through the sales parent', () => {
    expect(paths.filter(path => path.startsWith('/kunden') || path.startsWith('/auftraege'))).toEqual([]);
  });
});

describe('Product Hub Abschaltzugang', () => {
  const path = '/product-hub/geraete/03701a94-e0b3-4d56-8ce2-17a0ab79d720?tab=webseiten';
  it('öffnet für Super Admin direkt den Webseiten-Reiter von Skin Master Mini', () => {
    expect(reachablePaths(navItems, ['Super Admin'])).toContain(path);
  });
  it('erweitert nicht den Abschaltzugang anderer Rollen', () => {
    for (const role of ['Admin', 'Marketing', 'Vertrieb', 'Angebotsersteller']) {
      expect(reachablePaths(navItems, [role])).not.toContain(path);
    }
  });
});