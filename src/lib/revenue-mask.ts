import { useAuth } from '@/hooks/useAuth';

const MASK = '•••';

/**
 * Hook: returns { hide, mask } — Super Admins should NOT see total revenue
 * anywhere in the system (per business rule). All other roles see the value.
 */
export function useRevenueMask() {
  const { hasRole } = useAuth();
  const hide = hasRole('Super Admin');
  const mask = <T,>(formatted: T): T | string => (hide ? MASK : formatted);
  return { hide, mask, MASK };
}
