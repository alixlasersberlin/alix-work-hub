/** Generated periodic invoices have invoice IDs, not recurring-profile IDs. */
export function invoicePdfRequest(invoice: {
  zoho_invoice_id: string;
  source_system?: string | null;
}) {
  return {
    zoho_invoice_id: invoice.zoho_invoice_id,
    source_system: invoice.source_system ?? 'zoho_eu_1',
    resource: 'invoices' as const,
  };
}