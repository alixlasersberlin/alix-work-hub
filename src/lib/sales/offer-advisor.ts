/** Resolve only the advisor saved on the offer, never its author. */
export function offerSalesAdvisor(offer: {
  salesAdvisor?: unknown;
  sales_advisor?: unknown;
  payload?: { salesAdvisor?: unknown } | null;
}): string {
  const value = offer.salesAdvisor ?? offer.sales_advisor ?? offer.payload?.salesAdvisor;
  return typeof value === 'string' ? value.trim() : '';
}