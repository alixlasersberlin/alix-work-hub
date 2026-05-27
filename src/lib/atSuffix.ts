/**
 * Display helper for Alix Austria.
 * Appends "-AT" to customer numbers, order numbers and similar identifiers
 * when they belong to source_system = "zoho_eu_2".
 *
 * IMPORTANT: This is display-only. Original values in DB are never mutated
 * (Zoho external IDs and order_number must stay intact for sync).
 */

export const isAlixAustria = (sourceSystem?: string | null): boolean =>
  sourceSystem === "zoho_eu_2";

/**
 * Append "-AT" to a value if it belongs to Alix Austria.
 * Safely no-ops for null/empty values and values that already end with -AT.
 */
export function withAt(
  value: string | number | null | undefined,
  sourceSystem?: string | null,
): string {
  if (value == null || value === "") return "";
  const str = String(value);
  if (!isAlixAustria(sourceSystem)) return str;
  return str.endsWith("-AT") ? str : `${str}-AT`;
}
