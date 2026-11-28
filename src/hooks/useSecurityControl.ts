import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SecurityReport } from '@/lib/securityControl';

export const SECURITY_CONTROL_QUERY = ['security-control-report'] as const;
export function useSecurityControl(enabled = true) {
  return useQuery({
    queryKey: SECURITY_CONTROL_QUERY,
    enabled,
    queryFn: async (): Promise<SecurityReport> => {
      const { data, error } = await supabase.functions.invoke('security-remediate', { body: { action: 'control_overview' } });
      if (error) throw new Error('Sicherheitsbericht nicht verfügbar oder Zugriff nicht freigegeben.');
      if (!data?.reportId || !Array.isArray(data.findings)) throw new Error('Sicherheitsbericht unvollständig.');
      return data as SecurityReport;
    },
    staleTime: 30000,
  });
}