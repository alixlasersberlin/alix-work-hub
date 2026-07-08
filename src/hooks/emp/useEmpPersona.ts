import { useAuth } from '@/hooks/useAuth';
import { detectPersona, personaLabel, EmpPersona } from '@/lib/emp/roles';

export function useEmpPersona(): { persona: EmpPersona; label: string; roles: string[] } {
  const { roles } = useAuth();
  const persona = detectPersona(roles);
  return { persona, label: personaLabel[persona], roles };
}
