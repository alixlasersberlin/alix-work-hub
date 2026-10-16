import { describe, expect, it } from 'vitest';
import { depositInvoiceUpdate, findDepositInvoiceTarget, type DepositInvoiceTarget } from './deposit-invoice-target';

const orderId = '7d49501f-2230-44fe-9c2b-d613a47bac58';
const sourceRef = `order:${orderId}:AZ-AB-2026-04564`;
const placeholder: DepositInvoiceTarget = {
  id: 'b9b494a1-f879-46cf-b054-9b700ddf10ab', source_ref: `order:${orderId}`,
  invoice_number: null, gross_amount: '1500.00', paid_amount: 0,
  status: 'offen', release_status: 'wartet',
};

describe('Anzahlungsrechnung aus bestehendem Platzhalter', () => {
  it('nutzt für AZ-AB-2026-04564 den vorhandenen 1.500-Euro-Eintrag', () => {
    expect(findDepositInvoiceTarget([placeholder], sourceRef, orderId, 1500)?.id).toBe(placeholder.id);
  });
  it('verwendet keinen Platzhalter mit anderem Betrag', () => {
    expect(findDepositInvoiceTarget([placeholder], sourceRef, orderId, 1000)).toBeUndefined();
  });
  it('verwendet keine stornierte oder bereits ausgestellte Anzahlung als Platzhalter', () => {
    expect(findDepositInvoiceTarget([{ ...placeholder, status: 'storniert' }], sourceRef, orderId, 1500)).toBeUndefined();
    expect(findDepositInvoiceTarget([{ ...placeholder, invoice_number: 'AZ-ALT' }], sourceRef, orderId, 1500)).toBeUndefined();
  });
  it('bevorzugt den vorhandenen Rechnungsentwurf', () => {
    const draft = { ...placeholder, id: 'draft', source_ref: sourceRef, status: 'entwurf' };
    expect(findDepositInvoiceTarget([placeholder, draft], sourceRef, orderId, 1500)?.id).toBe('draft');
  });
  it('erhält Zahlungen und Freigaben und übernimmt die echte Rechnungsnummer', () => {
    const existing = { ...placeholder, paid_amount: 500, status: 'teilweise', release_status: 'freigegeben' };
    expect(depositInvoiceUpdate({ invoice_number: 'AZ-AB-2026-04564', paid_amount: 0, status: 'offen', release_status: 'nicht_freigegeben' }, existing, false)).toEqual({
      invoice_number: 'AZ-AB-2026-04564', paid_amount: 500, status: 'teilweise', release_status: 'freigegeben',
    });
  });
  it('stuft einen Entwurf beim Ausstellen auf offen hoch', () => {
    expect(depositInvoiceUpdate({}, { ...placeholder, status: 'entwurf' }, false).status).toBe('offen');
    expect(depositInvoiceUpdate({}, { ...placeholder, status: 'entwurf' }, true).status).toBe('entwurf');
  });
});