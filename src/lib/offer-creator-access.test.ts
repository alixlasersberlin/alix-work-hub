import { describe, it, expect } from 'vitest';
import { isOfferCreatorOnly } from './offer-creator-access';
describe('isOfferCreatorOnly', () => {
  it('sperrt Nutzer mit nur Angebotsersteller', () => expect(isOfferCreatorOnly(['Angebotsersteller'])).toBe(true));
  it('lässt Nutzer mit weiteren Rollen durch', () => expect(isOfferCreatorOnly(['Angebotsersteller', 'Admin'])).toBe(false));
});
