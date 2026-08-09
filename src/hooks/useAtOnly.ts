import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/contexts/TenantContext';

/**
 * Data Scope statt Rolle:
 * Liefert true, wenn der Datenbereich des Nutzers ausschließlich Österreich ist –
 * entweder über die Mandanten-Zuordnung (user_tenant_access) oder über die
 * Altrolle „Österreich“. In diesem Fall werden Listen in der UI zusätzlich auf
 * `source_system='zoho_eu_2'` eingeschränkt (die DB erzwingt es ohnehin via RLS).
 */
export function useAtOnly(): boolean {
  const { hasRole } = useAuth();
  const { allowedTenants, loading } = useTenant();
  if (hasRole('Österreich')) return true;
  if (loading) return false;
  return allowedTenants.length === 1 && allowedTenants[0]?.code === 'AT';
}

/**
 * @deprecated Rollenbasierte AT-Sperre wurde durch den Mandanten-Datenfilter
 * (Data Scope + RLS) ersetzt. Gibt immer false zurück.
 */
export function useAtRoleOnly(): boolean {
  return false;
}
