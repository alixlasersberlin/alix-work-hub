// VIP helper – ein Auftrag gilt als VIP, wenn entweder der Auftrag selbst
// oder der zugeordnete Kunde als VIP markiert ist.
export function isOrderVip(order: any): boolean {
  return !!(order?.is_vip || order?.customers?.is_vip);
}

export function isCustomerVip(customer: any): boolean {
  return !!customer?.is_vip;
}

/** Sortiert ein Array so, dass VIPs immer an Position 1 stehen – Reihenfolge sonst unverändert. */
export function vipFirst<T>(items: T[], isVip: (item: T) => boolean): T[] {
  const vips: T[] = [];
  const rest: T[] = [];
  for (const it of items) (isVip(it) ? vips : rest).push(it);
  return [...vips, ...rest];
}
