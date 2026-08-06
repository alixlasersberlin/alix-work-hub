import { useAuth } from '@/hooks/useAuth';

/**
 * Berechtigungen für das Modul "Provision Mitarbeiter".
 * Bearbeitung ausschließlich Admin / Super Admin, Buchhaltung nur lesend.
 */
export function useCommissionPermissions() {
  const { roles } = useAuth();
  const has = (r: string) => roles.includes(r);
  const isSuperAdmin = has('Super Admin');
  const isAdmin = has('Admin') || isSuperAdmin;
  const isAccounting = has('Buchhaltung EU') || has('Buchhaltung CH') || has('Buchhaltung Admin');
  return {
    isSuperAdmin,
    isAdmin,
    isAccounting,
    canRead: isAdmin || isAccounting,
    canManage: isAdmin,
    canApprove: isAdmin,
    canFinalApprove: isSuperAdmin,
    canDelete: isSuperAdmin,
  };
}
