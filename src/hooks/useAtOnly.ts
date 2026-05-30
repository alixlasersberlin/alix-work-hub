import { useAuth } from '@/hooks/useAuth';

/**
 * Liefert true, sobald der aktuelle Nutzer die Rolle „Österreich" besitzt.
 * In diesem Fall werden alle Listen/Abfragen in der UI strikt auf -AT
 * (source_system='zoho_eu_2') eingeschränkt – unabhängig davon, ob der
 * Nutzer zusätzlich Admin/Super Admin ist.
 */
export function useAtOnly(): boolean {
  const { hasRole } = useAuth();
  return hasRole('Österreich');
}
