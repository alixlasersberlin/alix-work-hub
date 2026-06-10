// Shared search + pagination helpers for Finance overview pages.

export type PageSize = 20 | 50 | 100 | 'all';
export const PAGE_SIZE_OPTIONS: PageSize[] = [20, 50, 100, 'all'];

/**
 * Extracts PLZ (postal code) from a free-form address-like string.
 * Matches German/Austrian-style 4-5 digit codes.
 */
export function extractPlz(s: unknown): string | null {
  if (!s) return null;
  const str = String(s);
  const m = str.match(/\b(\d{4,5})\b/);
  return m ? m[1] : null;
}

/**
 * Universal matcher: returns true if any of the row's searchable fields
 * (invoice number, order/reference number, customer name, city, PLZ, amount)
 * match the user's query.
 *
 * For numeric queries (e.g. "1234,50"), matches if total or balance equals
 * the parsed number (with small tolerance) or contains the digits.
 */
export function matchesQuery(row: Record<string, any>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  // Numeric query handling (Betrag search)
  const num = parseFloat(q.replace(/\./g, '').replace(',', '.'));
  if (!isNaN(num)) {
    const amounts = [row.total, row.balance, row.amount, row.amount_gross, row.amount_net]
      .map((v) => (v == null ? null : Number(v)))
      .filter((v): v is number => v != null && !isNaN(v));
    if (amounts.some((v) => Math.abs(v - num) < 0.01)) return true;
    // also allow plain-text contains for amounts (e.g. "150")
    if (amounts.some((v) => String(v.toFixed(2)).includes(q) || String(v).includes(q))) return true;
  }

  const haystack: (string | null | undefined)[] = [
    row.invoice_number,
    row.reference_number,
    row.order_number,
    row.customer_name,
    row.supplier_name,
    row.city,
    row.postal_code,
    row.zip,
    row.plz,
    extractPlz(row.billing_address),
    extractPlz(row.address),
    row.billing_address,
    row.address,
    row.device_name,
    row.notes,
    row.description,
    row.reference,
  ];
  return haystack.some((v) => (v ?? '').toString().toLowerCase().includes(q));
}

export function paginate<T>(rows: T[], pageSize: PageSize): T[] {
  if (pageSize === 'all') return rows;
  return rows.slice(0, pageSize);
}

export function pageSizeLabel(p: PageSize): string {
  return p === 'all' ? 'Alle' : String(p);
}
