import { useAuth } from '@/hooks/useAuth';

const CREDIT_ROLES = ['Super Admin', 'Admin', 'Geschäftsführung', 'Vertriebsleitung', 'Vertrieb', 'Finance'];

const STAGE_ROLES: Record<string, string[]> = {
  auto: ['Super Admin'],
  sales: ['Super Admin', 'Admin', 'Vertrieb', 'Vertriebsleitung', 'Geschäftsführung'],
  sales_lead: ['Super Admin', 'Admin', 'Vertriebsleitung', 'Geschäftsführung'],
  management: ['Super Admin', 'Admin', 'Geschäftsführung'],
  done: ['Super Admin'],
};

export function useCreditPermissions() {
  const { roles } = useAuth();
  const has = (r: string) => roles.includes(r);
  const isSuperAdmin = has('Super Admin');
  const canView = roles.some((r) => CREDIT_ROLES.includes(r));
  const canWrite = canView;
  const canDelete = isSuperAdmin;
  const canEditPolicies = isSuperAdmin;
  const canDecide = (stage: string) => (STAGE_ROLES[stage] ?? ['Super Admin']).some((r) => roles.includes(r));
  return { isSuperAdmin, canView, canWrite, canDelete, canEditPolicies, canDecide };
}
