import { useAuth } from '@/hooks/useAuth';

export function useRepairPermissions() {
  const { roles } = useAuth();
  const has = (r: string) => roles.includes(r);
  const isAdmin = has('Admin') || has('Super Admin');
  const isSuperAdmin = has('Super Admin');
  const isReparaturannahme = has('Reparaturannahme');
  const canEditAnnahme = isAdmin || isReparaturannahme || has('Order') || has('Tourenplanung');
  const canEditWerkstatt = isAdmin || isReparaturannahme || has('Order') || has('QM') || has('Technik');
  const canEditTechnik = isAdmin || isReparaturannahme || has('Order') || has('QM') || has('Technik');
  const canEditErsatzteile = isAdmin || isReparaturannahme || has('Order') || has('QM') || has('Technik');
  const canEditFinance = isAdmin || has('Finance');
  const canEditTouren = isAdmin || has('Tourenplanung') || has('Order') || isReparaturannahme;
  const canEditQuotes = isAdmin || has('Finance') || isReparaturannahme || has('Technik');
  const canEditShipping = isAdmin || isReparaturannahme || has('Tourenplanung') || has('Order');
  const canApproveCustomerEmail = isSuperAdmin || has('Finance');
  return {
    isAdmin,
    isSuperAdmin,
    isReparaturannahme,
    canEditAnnahme,
    canEditWerkstatt,
    canEditTechnik,
    canEditErsatzteile,
    canEditFinance,
    canEditTouren,
    canEditQuotes,
    canEditShipping,
    canApproveCustomerEmail,
  };
}
