export interface DepositInvoiceTarget {
  id: string;
  source_ref: string | null;
  invoice_number: string | null;
  gross_amount: number | string | null;
  paid_amount: number | string | null;
  status: string | null;
  release_status: string | null;
}

/** Reuse only the same invoice or an unissued order placeholder of the same amount. */
export function findDepositInvoiceTarget(
  rows: DepositInvoiceTarget[], sourceRef: string, orderId: string | null, gross: number,
): DepositInvoiceTarget | undefined {
  const invoice = rows.find(row => row.source_ref === sourceRef);
  if (invoice) return invoice;
  if (!orderId) return undefined;
  return rows.find(row =>
    row.source_ref === `order:${orderId}` &&
    !row.invoice_number?.trim() &&
    row.status !== 'storniert' &&
    Math.round(Number(row.gross_amount) * 100) === Math.round(gross * 100),
  );
}

/** Issuing an invoice must not reset payments or release decisions. */
export function depositInvoiceUpdate<T extends Record<string, unknown>>(
  payload: T, existing: DepositInvoiceTarget, draft: boolean,
) {
  return {
    ...payload,
    paid_amount: existing.paid_amount,
    release_status: existing.release_status,
    status: draft || existing.status !== 'entwurf' ? existing.status : 'offen',
  };
}