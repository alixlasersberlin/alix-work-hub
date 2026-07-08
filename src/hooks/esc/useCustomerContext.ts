import { useEffect, useState } from 'react';
import type { CrmCustomerContext } from '@/lib/esc/crm/types';
import { loadCustomerContext } from '@/lib/esc/crm/context';

export function useCustomerContext(customerId: string | null | undefined) {
  const [data, setData] = useState<CrmCustomerContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!customerId) { setData(null); return; }
    setLoading(true); setError(null);
    loadCustomerContext(customerId)
      .then((ctx) => { if (!cancelled) setData(ctx); })
      .catch((e) => { if (!cancelled) setError(String(e?.message || e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [customerId]);

  return { data, loading, error };
}
