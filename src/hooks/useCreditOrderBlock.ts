import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CreditOrderBlockResult {
  block: boolean;
  reason?: string | null;
  has_assessment: boolean;
  assessment_id?: string;
  score?: number | null;
  ampel?: 'gruen' | 'gelb' | 'orange' | 'rot' | null;
  status?: string;
  max_credit?: number;
  valid_until?: string | null;
  recommendation?: Record<string, any>;
  hint?: string;
}

/**
 * Prüft, ob eine Bestellung/Auftrag für einen Kunden bonitätsseitig freigegeben ist.
 * Nutzt SECURITY-DEFINER-RPC `credit_check_order_block`.
 */
export function useCreditOrderBlock(customerId: string | null | undefined, amount?: number | null) {
  const [data, setData] = useState<CreditOrderBlockResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    if (!customerId) { setData(null); return; }
    setLoading(true);
    (async () => {
      const { data } = await supabase.rpc('credit_check_order_block' as any, {
        _customer_id: customerId,
        _amount: amount ?? null,
      });
      if (!cancel) {
        setData((data as unknown as CreditOrderBlockResult) ?? null);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [customerId, amount]);

  return { data, loading };
}
