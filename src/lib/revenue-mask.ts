import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

const MASK = '•••';

// Global flag mirrored from the current session's role set so that plain
// module-level formatter functions (that cannot call hooks) can still respect
// the "hide revenue for Super Admin" business rule.
let hideRevenueGlobal = false;

export function setHideRevenueGlobal(hide: boolean) {
  hideRevenueGlobal = hide;
}
export function isRevenueHidden() {
  return hideRevenueGlobal;
}

/**
 * Wrap any pre-formatted currency string. Returns the mask if the current
 * user is Super Admin (per business rule), otherwise the original value.
 */
export function maskRevenueString(formatted: string): string {
  return hideRevenueGlobal ? MASK : formatted;
}

const baseEUR = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

/**
 * Hook for components: returns hide flag and a masked EUR formatter.
 */
export function useRevenueMask() {
  const { hasRole } = useAuth();
  const hide = hasRole('Super Admin');
  const mask = <T,>(formatted: T): T | string => (hide ? MASK : formatted);
  const fmtEUR = (n: number) => (hide ? MASK : baseEUR(n));
  return { hide, mask, fmtEUR, MASK };
}

/**
 * Mount once (e.g. in the root layout) so the module-level `hideRevenueGlobal`
 * always mirrors the current user's Super-Admin status.
 */
export function useSyncRevenueMaskGlobal() {
  const { hasRole } = useAuth();
  const hide = hasRole('Super Admin');
  useEffect(() => {
    setHideRevenueGlobal(hide);
  }, [hide]);
}

export const HIDDEN_REVENUE_LABEL = MASK;
