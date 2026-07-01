import { useAuth } from '@/hooks/useAuth';

const MASK = '•••';

const baseEUR = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

/**
 * Business rule: Super Admins do NOT see monetary totals / revenue anywhere
 * in the system. All other roles keep seeing the values.
 *
 * Usage inside a component:
 *   const { hide, mask, fmtEUR } = useRevenueMask();
 *   ...
 *   <div>{fmtEUR(revenue)}</div>
 */
export function useRevenueMask() {
  const { hasRole } = useAuth();
  const hide = hasRole('Super Admin');
  const mask = <T,>(formatted: T): T | string => (hide ? MASK : formatted);
  const fmtEUR = (n: number) => (hide ? MASK : baseEUR(n));
  return { hide, mask, fmtEUR, MASK };
}

export const HIDDEN_REVENUE_LABEL = MASK;
