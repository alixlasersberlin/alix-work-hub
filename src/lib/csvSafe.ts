/**
 * Spreadsheet-safe CSV cells: values starting with formula triggers (= + - @ tab CR)
 * are prefixed with an apostrophe so Excel/LibreOffice treat them as text, then quoted.
 */
export function neutralizeFormula(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function csvCell(value: unknown, delimiter = ';'): string {
  const s = neutralizeFormula(value);
  const needsQuote = s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(delimiter) || s.startsWith("'");
  return needsQuote ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvQuoted(value: unknown): string {
  return `"${neutralizeFormula(value).replace(/"/g, '""')}"`;
}
