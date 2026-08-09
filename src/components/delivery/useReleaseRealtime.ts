import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Liefert einen Zähler, der bei jedem Statuswechsel in delivery_approvals hochzählt.
 * Damit können Ampel-Komponenten ihre Daten in Echtzeit neu laden.
 */
export function useReleaseRealtime(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const channel = supabase
      .channel('delivery-approvals-ampel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_approvals' },
        () => setTick((t) => t + 1),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);
  return tick;
}

export default useReleaseRealtime;
