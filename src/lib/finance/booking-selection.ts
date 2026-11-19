export interface BookingInvoice {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  source_system: string | null;
  currency: string | null;
  balance: number | null;
  invoice_number: string | null;
  legal_invoice_number: string | null;
}

export function bookingAccountKey(invoice: BookingInvoice): string {
  return JSON.stringify([invoice.source_system, invoice.customer_id || invoice.id, invoice.currency]);
}

export function bookingInvoices<T extends BookingInvoice>(invoices: T[], search: string, account?: string): T[] {
  const query = search.trim().toLocaleLowerCase('de-DE');
  return invoices.filter(invoice => Number(invoice.balance) > 0 &&
    (!account || bookingAccountKey(invoice) === account) &&
    (!query || [invoice.customer_name, invoice.customer_id, invoice.invoice_number, invoice.legal_invoice_number]
      .some(value => value?.toLocaleLowerCase('de-DE').includes(query))));
}