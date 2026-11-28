import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SecurityLedgerResponse } from '@/lib/securityLedger';

export function useSecurityLedger() {
  return useQuery({
    queryKey: ['security-ledger-v7'],
    queryFn: async (): Promise<SecurityLedgerResponse> => {
      const { data, error } = await supabase.functions.invoke('security-remediate', { body: { action: 'continuation_overview' } });
      if (error) throw new Error('Sicherheits-Fortsetzungsstand nicht verfügbar oder Zugriff nicht freigegeben.');
      if (!data?.summary || !Array.isArray(data.items)) throw new Error('Fortsetzungsstand unvollständig.');
      return data as SecurityLedgerResponse;
    },
    staleTime: 60000,
  });
}
