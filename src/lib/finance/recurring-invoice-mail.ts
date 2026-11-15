export type InvoiceMailRow = {
  id: string; zoho_invoice_id: string; source_system: string;
  customer_id: string | null; customer_name: string | null;
  invoice_number: string | null; invoice_date: string | null;
  status: string | null; total: number | null; currency: string | null;
  raw_data?: unknown;
};

export function selectedInvoiceRows(rows: InvoiceMailRow[], customerIds: readonly string[], invoiceDate = '') {
  const customers = new Set(customerIds);
  const seen = new Set<string>();
  return rows.filter(row => {
    if (invoiceDate && row.invoice_date?.slice(0, 10) !== invoiceDate) return false;
    const key = `${row.source_system}:${row.zoho_invoice_id}`;
    if (!row.customer_id || !customers.has(row.customer_id) || !row.zoho_invoice_id || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function invoiceMailBlock(row: InvoiceMailRow): string | null {
  if (['draft', 'void', 'cancelled', 'canceled', 'storniert', 'zurueckgehalten'].includes((row.status || '').toLowerCase())) return 'Entwurf, storniert oder zurückgehalten';
  if (!row.source_system.startsWith('zoho_') || /^(local-|manual-)/.test(row.zoho_invoice_id)) return 'Kein bestätigtes Zoho-Rechnungs-PDF';
  return null;
}

export function invoiceRecipient(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '';
  const data = raw as Record<string, unknown>;
  for (const key of ['email', 'customer_email']) {
    if (typeof data[key] === 'string' && data[key].trim()) return data[key].trim();
  }
  const people = data.contact_persons;
  if (Array.isArray(people)) {
    const emails = [...new Set(people.map(person => person?.email).filter((email): email is string => typeof email === 'string' && email.includes('@')))];
    if (emails.length === 1) return emails[0];
  }
  return '';
}

export function invoiceMailAccepted(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const result = data as Record<string, unknown>;
  return result.success === true && !result.error && !result.skipped && !result.not_sent && typeof result.resend_id === 'string' && result.resend_id.length > 0;
}