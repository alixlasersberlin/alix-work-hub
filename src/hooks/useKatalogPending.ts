import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Live pending counts for the Katalog Freigabe-Center.
 * Subscribes to catalog_items + catalog_item_prices via Supabase Realtime.
 */
export function useKatalogPending() {
  const [items, setItems] = useState(0);
  const [prices, setPrices] = useState(0);
  const client = supabase as any;

  const refresh = async () => {
    const [it, pr] = await Promise.all([
      client.from('catalog_items').select('id', { count: 'exact', head: true })
        .eq('status', 'zur_pruefung').is('approved_at', null),
      client.from('catalog_item_prices').select('id', { count: 'exact', head: true })
        .eq('price_status', 'zur_freigabe').is('approved_at', null),
    ]);
    setItems(it.count ?? 0);
    setPrices(pr.count ?? 0);
  };

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel('katalog-pending')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog_items' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog_item_prices' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { items, prices, total: items + prices, refresh };
}
