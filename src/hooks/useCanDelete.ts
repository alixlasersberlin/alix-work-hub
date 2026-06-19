import { useAuth } from '@/hooks/useAuth';

/**
 * Zentrale Berechtigungsprüfung für Löschvorgänge.
 *
 * Regel (siehe mem://auth/delete-restriction):
 *   DELETE auf allen Tabellen ist ausschließlich Super Admin erlaubt.
 *
 * Die Datenbank erzwingt dies serverseitig via RLS. Dieser Hook stellt
 * die gleiche Regel in der UI sicher, sodass Löschen-Buttons & -Menüs
 * für andere Rollen ausgeblendet/deaktiviert werden.
 */
export function useCanDelete(): boolean {
  const { hasRole } = useAuth();
  return hasRole('Super Admin');
}
