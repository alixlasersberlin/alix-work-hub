import { describe, it, expect } from 'vitest';
import { isOfferCreatorOnly } from './offer-creator-access';
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
