// Phase 9 shared helpers
export const BUDGET_CATEGORIES = [
  'Umsatz',
  'Wareneinkauf',
  'Personal',
  'Miete',
  'Marketing',
  'AfA',
  'Zinsen',
  'Sonstige Aufwendungen',
] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

const lower = (s: string) => (s || '').toLowerCase();

export function classifyTx(tx: any): 'Umsatz' | 'Sonstige Aufwendungen' | 'Zinsen' | null {
  const t = lower(tx.transaction_type);
  if (['rechnung', 'einnahme', 'erlös', 'erloes'].some(x => t.includes(x))) return 'Umsatz';
  if (t.includes('zins')) return 'Zinsen';
  if (['ausgabe', 'aufwand', 'eingangsrechnung'].some(x => t.includes(x))) return 'Sonstige Aufwendungen';
  return null;
}

export function mapIncomingCategory(c: string | null): BudgetCategory {
  if (!c) return 'Sonstige Aufwendungen';
  const x = c.toLowerCase();
  if (x.includes('warenein')) return 'Wareneinkauf';
  if (x.includes('personal') || x.includes('lohn') || x.includes('gehalt')) return 'Personal';
  if (x.includes('miete')) return 'Miete';
  if (x.includes('marketing') || x.includes('werbung')) return 'Marketing';
  return 'Sonstige Aufwendungen';
}

export const fmt = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

export const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
