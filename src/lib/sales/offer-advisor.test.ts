import { describe, expect, it } from 'vitest';
import { offerSalesAdvisor } from './offer-advisor';
import { buildCreatorStats } from '@/components/sales/OfferCreatorChart';
import { computeReps, type OfferRow } from './offer-analytics';

describe('Gespeicherter Verkaufsberater statt Erfasser', () => {
  const offer = { offerNumber: 'ANG-2026-04527', salesAdvisor: 'Eitner', createdByName: 'L. Scheidler', totals: { net: 0, tax: 0, gross: 25400 } };

  it('verwendet den Berater aus Liste, vollständigem Angebot und Auswertung', () => {
    expect(offerSalesAdvisor(offer)).toBe('Eitner');
    expect(offerSalesAdvisor({ sales_advisor: ' Eitner ' })).toBe('Eitner');
    expect(offerSalesAdvisor({ payload: { salesAdvisor: 'Eitner' } })).toBe('Eitner');
  });

  it('ersetzt einen fehlenden Berater nicht durch den Erfasser', () => {
    expect(offerSalesAdvisor({ ...offer, salesAdvisor: undefined })).toBe('');
  });

  it('ordnet Angebotsstatistiken dem Verkaufsberater zu', () => {
    expect(buildCreatorStats([offer], () => false)).toEqual([
      { name: 'Eitner', total: 1, offen: 1, unterzeichnet: 0, volumen: 25400, schnitt: 25400, quote: 0 },
    ]);
  });

  it('ordnet das Verkäuferranking dem Verkaufsberater zu', () => {
    const row = { created_by_name: 'L. Scheidler', payload: { salesAdvisor: 'Eitner' }, total_gross: 25400, status: 'draft' } as OfferRow;
    expect(computeReps([row]).map(r => ({ name: r.name, volume: r.volume }))).toEqual([{ name: 'Eitner', volume: 25400 }]);
  });
});