import { describe, expect, it } from 'vitest';
import { bookingAccountKey, bookingInvoices, type BookingInvoice } from './booking-selection';

const invoice: BookingInvoice = { id: 'i1', customer_id: 'c1', customer_name: 'Perles', source_system: 'zoho_eu_1', currency: 'EUR', balance: 348.33, invoice_number: 'INV-12314', legal_invoice_number: null };

describe('booking selection', () => {
  it('shows only open invoices', () => {
    expect(bookingInvoices([invoice, { ...invoice, id: 'paid', balance: 0 }], '').map(i => i.id)).toEqual(['i1']);
  });
  it('keeps source-scoped customer accounts separate', () => {
    const other = { ...invoice, id: 'i2', source_system: 'zoho_eu_2' };
    expect(bookingInvoices([invoice, other], '', bookingAccountKey(invoice)).map(i => i.id)).toEqual(['i1']);
  });
  it('keeps currencies separate', () => {
    expect(bookingInvoices([invoice, { ...invoice, id: 'ch', currency: 'CHF' }], '', bookingAccountKey(invoice)).map(i => i.id)).toEqual(['i1']);
  });
  it('searches invoice numbers and customer accounts', () => {
    expect(bookingInvoices([invoice], 'INV-12314')).toHaveLength(1);
    expect(bookingInvoices([invoice], 'c1')).toHaveLength(1);
    expect(bookingInvoices([invoice], 'absent')).toHaveLength(0);
  });
});