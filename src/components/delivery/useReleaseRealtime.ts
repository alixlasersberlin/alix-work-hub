import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Liefert einen Zähler, der bei jedem Statuswechsel in delivery_approvals hochzählt.
 * Damit können Ampel-Komponenten ihre Daten in Echtzeit neu laden.
 */
export function useReleaseRealtime(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    // eindeutiger Channel-Name je Hook-Instanz – sonst wird ein bereits
    // subscribter Channel wiederverwendet ("cannot add postgres_changes
    // callbacks after subscribe()")
    const name = `delivery-approvals-ampel-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(name)
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
