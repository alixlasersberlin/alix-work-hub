import { useState, useEffect } from 'react';
import { getEcpRole, setEcpRole, EcpRole } from '@/lib/ecp/roles';

export function useEcpRole() {
  const [role, setRole] = useState<EcpRole>(() => getEcpRole());
  useEffect(() => { setEcpRole(role); }, [role]);
  return { role, setRole };
}
