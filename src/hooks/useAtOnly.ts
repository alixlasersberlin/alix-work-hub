import { useAuth } from '@/hooks/useAuth';

/**
 * Liefert true, wenn der aktuelle Nutzer ausschließlich die Rolle „Österreich" besitzt
 * (oder zumindest kein Admin/Super Admin ist). In diesem Fall werden alle Listen
 * auf -AT (source_system='zoho_eu_2') eingeschränkt.
 */
export function useAtOnly(): boolean {
  const { hasRole, isAdmin } = useAuth();
  return hasRole('Österreich') && !isAdmin;
}
