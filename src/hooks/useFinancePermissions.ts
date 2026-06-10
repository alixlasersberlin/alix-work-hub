import { useAuth } from '@/hooks/useAuth';

export function useFinancePermissions() {
  const { roles } = useAuth();
  const has = (r: string) => roles.includes(r);
  const isSuperAdmin = has('Super Admin');
  const isAdmin = has('Admin') || isSuperAdmin;
  const canWrite = isAdmin || has('Finance') || has('Geschäftsführung');
  const canRead = canWrite || has('Kundenservice') || has('Serviceleitung');
  const canDelete = isSuperAdmin;
  return { isSuperAdmin, isAdmin, canRead, canWrite, canDelete };
}
