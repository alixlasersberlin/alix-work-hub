import { describe, expect, it } from 'vitest';
import { invoicePdfRequest } from './invoice-pdf-request';

describe('PDF einer erzeugten periodischen Rechnung', () => {
  it('ruft INV-12275 als konkrete Rechnung statt als Ratenprofil ab', () => {
    expect(invoicePdfRequest({ zoho_invoice_id: '598077000010283522', source_system: 'zoho_eu_1' }))
      .toEqual({ zoho_invoice_id: '598077000010283522', source_system: 'zoho_eu_1', resource: 'invoices' });
  });
  it('behält den Mandanten der Rechnung bei', () => {
    expect(invoicePdfRequest({ zoho_invoice_id: 'at-invoice', source_system: 'zoho_eu_2' }).source_system)
      .toBe('zoho_eu_2');
  });
});