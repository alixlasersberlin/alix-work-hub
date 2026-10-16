import { describe, expect, it } from 'vitest';
import { matchesOfferSearch } from './offer-search';

describe('Angebotssuche', () => {
  const offer = { offerNumber: 'ANG-2026-04568', createdByName: 'L. Scheidler', customer: { company_name: 'Testkunde', email: 'kunde@example.com' } };

  it('findet Angebote nach Verkaufsberater unabhängig von Großschreibung', () => {
    expect(matchesOfferSearch(offer, ' SCHEIDLER ')).toBe(true);
    expect(matchesOfferSearch(offer, 'Müller')).toBe(false);
  });

  it('sucht weiterhin nach Angebotsnummer und Kunde', () => {
    expect(matchesOfferSearch(offer, '04568')).toBe(true);
    expect(matchesOfferSearch(offer, 'Testkunde')).toBe(true);
    expect(matchesOfferSearch(offer, 'anderer Kunde')).toBe(false);
  });
});