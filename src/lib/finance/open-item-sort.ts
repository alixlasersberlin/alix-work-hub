export type OpenItemSortKey = 'customer' | 'invoice' | 'due' | 'total' | 'paid' | 'balance' | 'lastMail';
export type SortDir = 'asc' | 'desc';
export type SortableOpenItem = {
  customer_name: string | null; invoice_number: string | null; legal_invoice_number: string | null;
  due_date: string | null; total: number | null; paid: number | null; balance: number | null;
};

const text = (v: string | null | undefined) => (v ?? '').trim();

/** Sorts a copy; empty values always go last regardless of direction. */
export function sortOpenItems<T extends SortableOpenItem & { id: string }>(
  items: T[], key: OpenItemSortKey, dir: SortDir, lastMailAt: (id: string) => string | null = () => null,
): T[] {
  const value = (i: T): string | number | null => {
    switch (key) {
      case 'customer': return text(i.customer_name) || null;
      case 'invoice': return text(i.legal_invoice_number || i.invoice_number) || null;
      case 'due': return i.due_date || null;
      case 'lastMail': return lastMailAt(i.id) || null;
      case 'total': return i.total == null ? null : Number(i.total);
      case 'paid': return i.paid == null ? null : Number(i.paid);
      case 'balance': return i.balance == null ? null : Number(i.balance);
    }
  };
  const sign = dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const va = value(a), vb = value(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sign;
    return String(va).localeCompare(String(vb), 'de', { numeric: true, sensitivity: 'base' }) * sign;
  });
}
