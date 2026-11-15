import { describe, expect, it } from 'vitest';
import { invoiceCustomer, initialInvoiceSelection, selectedInvoiceRows, invoiceMailBlock, invoiceMailAccepted, invoiceRecipient, type InvoiceMailRow } from './recurring-invoice-mail';
const row: InvoiceMailRow = { id: 'a', zoho_invoice_id: '123', source_system: 'zoho_eu_1', customer_id: 'selected', customer_name: 'Kunde', invoice_number: 'INV-1', invoice_date: '2026-11-15', status: 'paid', total: 100, currency: 'EUR' };
describe('selected invoice email', () => {
  it('resolves Zoho customer IDs to internal customers only in the same source and rejects ambiguity', () => {
    const customer = { id: '0600db76-9af8-4367-b5b9-335d21212bdc', external_customer_id: '598077000006880178', source_system: 'zoho_eu_1', email: 'example@example.com' };
    const invoice = { ...row, customer_id: '598077000006880178' };
    expect(invoiceCustomer(invoice, [customer])).toEqual(customer);
    expect(invoiceCustomer({ ...invoice, source_system: 'zoho_eu_2' }, [customer])).toBeUndefined();
    expect(invoiceCustomer(invoice, [customer, { ...customer, id: 'duplicate' }])).toBeUndefined();
    expect(invoiceCustomer({ ...row, customer_id: customer.id }, [customer])).toEqual(customer);
  });
  it('selects latest invoices of marked accounts without selecting their historical invoices', () => {
    const older = { ...row, id: 'older', zoho_invoice_id: 'old', invoice_date: '2026-10-01' };
    const other = { ...row, id: 'other', zoho_invoice_id: 'other', customer_id: 'other-customer', invoice_date: '2026-11-01' };
    const hidden = { ...row, id: 'hidden', customer_id: 'hidden' };
    const rows = selectedInvoiceRows([row, older, other, hidden], ['selected', 'other-customer']);
    expect([...initialInvoiceSelection(rows)]).toEqual(['a', 'other']);
    expect([...initialInvoiceSelection(rows, '2026-10-01')]).toEqual(['older']);
    expect([...initialInvoiceSelection([{ ...row, status: 'draft' }, older])]).toEqual([]);
  });
  it('includes older selected-customer invoices without a date filter', () => {
    const novemberInvoice = { ...row, invoice_date: '2026-11-01' };
    expect(selectedInvoiceRows([novemberInvoice], ['selected'])).toEqual([novemberInvoice]);
    expect(selectedInvoiceRows([novemberInvoice], ['selected'], '2026-11-15')).toEqual([]);
    expect(selectedInvoiceRows([novemberInvoice], ['selected'], '2026-11-01')).toEqual([novemberInvoice]);
  });
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