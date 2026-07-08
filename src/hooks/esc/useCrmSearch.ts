import { useEffect, useState } from 'react';
import type { CrmSearchHit } from '@/lib/esc/crm/types';
import { searchCustomers } from '@/lib/esc/crm/search';

export function useCrmSearch(term: string, debounceMs = 200) {
  const [hits, setHits] = useState<CrmSearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!term || term.trim().length < 2) { setHits([]); return; }
    setLoading(true);
    const h = setTimeout(async () => {
      try {
        const r = await searchCustomers(term);
        setHits(r);
      } finally {
        setLoading(false);
      }
    }, debounceMs);
    return () => clearTimeout(h);
  }, [term, debounceMs]);

  return { hits, loading };
}
