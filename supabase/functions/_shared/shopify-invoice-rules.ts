type Snapshot = {
  total: number; outstanding: number; paid: number; currency: string; email: string | null;
  status: string; refunded: number;
  invoice_tax: { included: boolean; total: number; shipping: number; lines: { title: string; rate: number; amount: number }[] } | null;
  items: { name: string; sku?: string | null; quantity: number; amount: number }[];
};
const round = (n: number) => Math.round(n * 100) / 100;

export function invoiceSnapshot(order: Snapshot) {
  if (order.status === 'storniert') throw new Error('Stornierte Bestellung – manuelle Rechnungsprüfung erforderlich.');
  if (order.refunded > 0) throw new Error('Bereits erstattete Bestellung – manuelle Rechnungsprüfung erforderlich.');
  if (!order.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email) || /[^\x00-\x7F]/.test(order.email)) throw new Error('Gültige Bestell-E-Mail fehlt.');
  const tax = order.invoice_tax;
  if (!tax) throw new Error('Bestätigte Shopify-Steuerdaten fehlen.');
  const entries = order.items.filter(i => i.quantity > 0).map(i => ({ name: i.name, sku: i.sku, quantity: i.quantity, amount: round(i.amount) }));
  if (tax.shipping > 0) entries.push({ name: 'Versand', sku: null, quantity: 1, amount: round(tax.shipping) });
  const sum = round(entries.reduce((s, i) => s + i.amount, 0));
  if (Math.abs(round(sum + (tax.included ? 0 : tax.total)) - order.total) > 0.02) throw new Error('Positionen, Versand und Steuern stimmen nicht mit dem Shopify-Gesamtbetrag überein.');
  if (order.total < 0 || tax.total < 0 || tax.total > order.total) throw new Error('Ungültige Rechnungsbeträge.');
  return {
    recipient: order.email.trim(), currency: order.currency, total: round(order.total),
    net: round(order.total - tax.total), tax: round(tax.total), tax_included: tax.included,
    tax_lines: tax.lines, items: entries, balance: round(Math.max(0, Math.min(order.outstanding, order.total))),
    paid: round(Math.max(0, order.paid)),
  };
}

export function paymentText(invoice: { balance: number; currency: string }) {
  return invoice.balance <= 0 ? 'Die Rechnung ist bereits bezahlt. Es ist keine weitere Zahlung erforderlich.'
    : `Offener Betrag: ${invoice.balance.toLocaleString('de-DE', { style: 'currency', currency: invoice.currency })}. Bitte verwenden Sie die Rechnungsnummer als Verwendungszweck.`;
}