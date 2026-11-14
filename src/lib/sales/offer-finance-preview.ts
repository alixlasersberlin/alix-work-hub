export function offerFinancePreview(price: number, discount: number, downPayment: number, term: number) {
  const cents = (value: number) => Math.round(value * 100);
  if (![price, discount, downPayment, term].every(Number.isFinite) || price <= 0 || discount < 0 || discount > price || downPayment < 0 || !Number.isInteger(term) || term < 1 || term > 72) return null;
  const total = cents(price) - cents(discount);
  const remaining = total - cents(downPayment);
  if (remaining <= 0) return null;
  return { total: total / 100, downPayment: cents(downPayment) / 100, remaining: remaining / 100, term };
}