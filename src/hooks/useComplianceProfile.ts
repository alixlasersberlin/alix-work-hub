import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ComplianceProfile {
  compliance_access: boolean;
  compliance_role: string | null;
  compliance_only_user: boolean;
  compliance_default_project_id: string | null;
  full_name: string | null;
  email: string | null;
}

export const COMPLIANCE_ROLES = [
  'COMPLIANCE_USER',
  'SOFTWARE_DEVELOPER',
  'SOFTWARE_TESTER',
  'VALIDATION_LEAD',
  'RISK_MANAGER',
  'QA_REVIEWER',
  'REGULATORY',
  'PROJECT_MANAGER',
  'AUDITOR_READONLY',
  'SUPPLIER_READONLY',
  'SUPERADMIN',
] as const;

export type ComplianceRole = (typeof COMPLIANCE_ROLES)[number];

const READONLY_ROLES: string[] = ['AUDITOR_READONLY', 'SUPPLIER_READONLY'];
const REVIEW_ROLES: string[] = ['QA_REVIEWER', 'REGULATORY', 'VALIDATION_LEAD', 'PROJECT_MANAGER', 'SUPERADMIN'];
const LEAD_ROLES: string[] = ['VALIDATION_LEAD', 'PROJECT_MANAGER', 'QA_REVIEWER', 'REGULATORY', 'SUPERADMIN'];

/** Lädt die Compliance-Felder des angemeldeten Benutzers. */
export function useComplianceProfile() {
  const { user, roles, loading: authLoading } = useAuth();
  const isSuperAdmin = roles.includes('Super Admin');

  const query = useQuery({
    queryKey: ['compliance-profile', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<ComplianceProfile | null> => {
      const { data, error } = await (supabase as any)
        .from('user_profiles')
        .select('compliance_access, compliance_role, compliance_only_user, compliance_default_project_id, full_name, email')
        .eq('id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as ComplianceProfile) || null;
    },
  });

  const profile = query.data || null;
  const role = (profile?.compliance_role || (isSuperAdmin ? 'SUPERADMIN' : null)) as ComplianceRole | null;

  return {
    loading: authLoading || (!!user && query.isLoading),
    profile,
    role,
    isSuperAdmin,
    hasAccess: isSuperAdmin || !!profile?.compliance_access,
    /** Nur-Compliance-Nutzer: sieht ausschließlich /software-compliance/* */
    complianceOnly: !isSuperAdmin && !!profile?.compliance_only_user,
    isSupplier: role === 'SUPPLIER_READONLY',
    isReadOnly: !!role && READONLY_ROLES.includes(role),
    canReview: isSuperAdmin || (!!role && REVIEW_ROLES.includes(role)),
    isLead: isSuperAdmin || (!!role && LEAD_ROLES.includes(role)),
    isComplianceAdmin: isSuperAdmin || role === 'SUPERADMIN' || role === 'PROJECT_MANAGER',
    refetch: query.refetch,
  };
}

/** Schreibt einen Audit-Trail-Eintrag (best effort). */
export async function logCompliance(
  action: string,
  detail?: Record<string, unknown>,
  ids?: { projectId?: string | null; taskId?: string | null },
) {
  try {
    const { data } = await supabase.auth.getUser();
    const uid = data?.user?.id;
    if (!uid) return;
    await (supabase as any).from('compliance_audit_log').insert({
      user_id: uid,
      project_id: ids?.projectId ?? null,
      task_id: ids?.taskId ?? null,
      action,
      detail: detail ?? null,
    });
  } catch {
    /* ignore */
  }
}
