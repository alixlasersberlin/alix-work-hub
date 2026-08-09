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

/**
 * True, wenn „Österreich" die einzige Rolle des Nutzers ist.
 * Dann darf ausschließlich auf AT-Module zugegriffen werden – die Rolle
 * selbst eröffnet keinerlei weitere Zugriffe.
 */
export function useAtRoleOnly(): boolean {
  const { roles } = useAuth();
  return roles.length > 0 && roles.every((r) => r === 'Österreich');
}

