import { useAuth } from '@/hooks/useAuth';

export function useRepairPermissions() {
  const { roles } = useAuth();
  const has = (r: string) => roles.includes(r);
  const isAdmin = has('Admin') || has('Super Admin');
  const isSuperAdmin = has('Super Admin');
  const canEditAnnahme = isAdmin || has('Order') || has('Tourenplanung');
  const canEditWerkstatt = isAdmin || has('Order') || has('QM');
  const canEditTechnik = isAdmin || has('Order') || has('QM');
  const canEditErsatzteile = isAdmin || has('Order') || has('QM');
  const canEditFinance = isAdmin || has('Finance');
  const canEditTouren = isAdmin || has('Tourenplanung') || has('Order');
  const canApproveCustomerEmail = isSuperAdmin || has('Finance');
  return {
    isAdmin,
    isSuperAdmin,
    canEditAnnahme,
    canEditWerkstatt,
    canEditTechnik,
    canEditErsatzteile,
    canEditFinance,
    canEditTouren,
    canApproveCustomerEmail,
  };
}
