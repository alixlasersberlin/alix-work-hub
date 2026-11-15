import { describe, expect, it } from 'vitest';
import { selectedInvoiceRows, invoiceMailBlock, invoiceMailAccepted, invoiceRecipient, type InvoiceMailRow } from './recurring-invoice-mail';
const row: InvoiceMailRow = { id: 'a', zoho_invoice_id: '123', source_system: 'zoho_eu_1', customer_id: 'selected', customer_name: 'Kunde', invoice_number: 'INV-1', invoice_date: '2026-11-15', status: 'paid', total: 100, currency: 'EUR' };
describe('selected invoice email', () => {
  it('only includes selected customers and deduplicates the same Zoho invoice', () => {
    expect(selectedInvoiceRows([row, { ...row, id: 'copy' }, { ...row, customer_id: 'hidden', zoho_invoice_id: '456' }], ['selected'])).toEqual([row]);
    expect(selectedInvoiceRows([row], [])).toEqual([]);
  });
  it('blocks drafts, holds and cancellations', () => {
    for (const status of ['draft', 'void', 'zurueckgehalten', 'storniert']) expect(invoiceMailBlock({ ...row, status })).not.toBeNull();
    expect(invoiceMailBlock(row)).toBeNull();
  });
  it('does not send local placeholders as Zoho invoices', () => {
    expect(invoiceMailBlock({ ...row, zoho_invoice_id: 'local-123' })).not.toBeNull();
  });
  it('requires actual provider acceptance, not skipped or uncertain sends', () => {
    expect(invoiceMailAccepted({ success: true, resend_id: 'provider-id' })).toBe(true);
    expect(invoiceMailAccepted({ success: true, skipped: true })).toBe(false);
    expect(invoiceMailAccepted({ success: true })).toBe(false);
  });
  it('never guesses among multiple recipient addresses', () => {
    expect(invoiceRecipient({ contact_persons: [{ email: 'a@example.com' }, { email: 'b@example.com' }] })).toBe('');
    expect(invoiceRecipient({ email: 'a@example.com' })).toBe('a@example.com');
  });
});