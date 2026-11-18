import { describe, it, expect } from 'vitest';
import { isOfferCreatorOnly, offerCreatorRedirect, shouldForceWelcome } from './offer-creator-access';
describe('isOfferCreatorOnly', () => {
  it('sperrt Nutzer mit nur Angebotsersteller', () => expect(isOfferCreatorOnly(['Angebotsersteller'])).toBe(true));
  it('lässt Nutzer mit weiteren Rollen durch', () => expect(isOfferCreatorOnly(['Angebotsersteller', 'Admin'])).toBe(false));
  it('beschränkt L. Scheidlers wiederhergestellte Rollen vom 14. November 2026 nicht auf eigene Angebote', () => {
    expect(isOfferCreatorOnly(['Auftragsverwaltung', 'Finanzierungen', 'Katalog', 'Order', 'QM', 'Reparaturannahme', 'SACHBEARBEITUNG', 'Tourenplanung'])).toBe(false);
  });
  it('beschränkt Sanaes wiederhergestellte Auftragsverwaltung vom 14. November 2026 nicht auf eigene Angebote', () => {
    expect(isOfferCreatorOnly(['Auftragsverwaltung'])).toBe(false);
  });
});

describe('offer creator navigation', () => {
  const roles = ['Angebotsersteller'];
  it('does not bounce Sanae back to welcome after redirecting to offers', () => {
    expect(offerCreatorRedirect(roles, '/willkommen')).toBe('/verkauf/angebote');
    expect(offerCreatorRedirect(roles, '/verkauf/angebote')).toBeNull();
    expect(shouldForceWelcome(roles, true)).toBe(false);
  });
  it('preserves mandatory welcome for other roles', () => {
    expect(shouldForceWelcome(['Admin'], true)).toBe(true);
    expect(shouldForceWelcome(['Admin'], false)).toBe(false);
  });
  it.each(['/mfa-setup', '/mfa-challenge', '/mfa-recovery', '/passwort-setzen'])('allows the security step %s without a competing redirect', (path) => {
    expect(offerCreatorRedirect(roles, path)).toBeNull();
  });
  it('still redirects an offer creator away from customer records', () => {
    expect(offerCreatorRedirect(roles, '/kunden')).toBe('/verkauf/angebote');
  });
});
