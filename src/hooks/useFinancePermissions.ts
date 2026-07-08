import { useAuth } from '@/hooks/useAuth';

export function useFinancePermissions() {
  const { roles } = useAuth();
  const has = (r: string) => roles.includes(r);
  const isSuperAdmin = has('Super Admin');
  const isAdmin = has('Admin') || isSuperAdmin;
  const canWrite = isAdmin;
  const canRead = isAdmin;
  const canDelete = isSuperAdmin;
  return { isSuperAdmin, isAdmin, canRead, canWrite, canDelete };
}
