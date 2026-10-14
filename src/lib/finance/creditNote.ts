/** Reine Rechenregeln für Gutschriften (serverseitig zusätzlich erzwungen). */
export function splitGross(gross: number, vatRate: number) {
  const g = Math.round(gross * 100) / 100;
  const net = Math.round((g / (1 + vatRate / 100)) * 100) / 100;
  return { gross: g, net, vat: Math.round((g - net) * 100) / 100 };
}

/** Maximal noch gutschreibbarer Betrag einer Rechnung. */
export function remainingCreditable(invoiceTotal: number | null | undefined, alreadyCredited: number) {
  if (invoiceTotal == null) return Infinity;
  return Math.max(0, Math.round((invoiceTotal - alreadyCredited) * 100) / 100);
}
