// Helpers for "Mehrfachbestellungen": when several orders share the same
// order_number (e.g. SO-4194), append -1, -2, ... in chronological order.
// A unique order keeps its plain number (no suffix).

type OrderLike = {
  id: string;
  order_number?: string | null;
  order_date?: string | null;
  created_at?: string | null;
};

function chronoKey(o: OrderLike) {
  return o.order_date || o.created_at || '';
}

/**
 * Given the full list of orders, returns a map { orderId -> displayNumber }
 * where displayNumber = "<order_number>-<N>" if there are duplicates,
 * else just "<order_number>".
 */
export function buildOrderNumberMap(orders: OrderLike[]): Record<string, string> {
  const groups = new Map<string, OrderLike[]>();
  for (const o of orders) {
    const key = (o.order_number || '').trim();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  }
  const result: Record<string, string> = {};
  for (const [num, arr] of groups) {
    if (arr.length <= 1) {
      result[arr[0].id] = num;
      continue;
    }
    const sorted = [...arr].sort((a, b) => {
      const ka = chronoKey(a);
      const kb = chronoKey(b);
      if (ka === kb) return a.id.localeCompare(b.id);
      return ka.localeCompare(kb);
    });
    sorted.forEach((o, idx) => {
      result[o.id] = `${num}-${idx + 1}`;
    });
  }
  return result;
}

/**
 * Compute the next suffix for a new order matching `order_number` given the
 * existing orders sharing that number. Returns the full display number, e.g.
 * existing [SO-4194] + new => "SO-4194-2" (and the existing one becomes "-1").
 * If no existing siblings: returns the number unchanged.
 */
export function nextOrderNumberSuffix(orderNumber: string, siblingsCount: number): string {
  if (siblingsCount <= 0) return orderNumber;
  return `${orderNumber}-${siblingsCount + 1}`;
}

/**
 * For a single order's display, fetches all orders sharing the number and
 * computes its suffix. Pure function — caller provides the siblings.
 */
export function displayOrderNumber(
  order: OrderLike,
  siblings: OrderLike[],
): string {
  const base = (order.order_number || '').trim();
  if (!base) return '';
  const same = siblings.filter(s => (s.order_number || '').trim() === base);
  if (same.length <= 1) return base;
  const sorted = [...same].sort((a, b) => {
    const ka = chronoKey(a);
    const kb = chronoKey(b);
    if (ka === kb) return a.id.localeCompare(b.id);
    return ka.localeCompare(kb);
  });
  const idx = sorted.findIndex(o => o.id === order.id);
  return idx < 0 ? base : `${base}-${idx + 1}`;
}
