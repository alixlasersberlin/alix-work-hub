import { useEffect, useState } from 'react';
import { getMessages, subscribeEch } from '@/lib/esc/ech/store';
import type { EchMessage } from '@/lib/esc/ech/types';

export function useEchMessages() {
  const [items, setItems] = useState<EchMessage[]>(getMessages());
  useEffect(() => {
    const unsub = subscribeEch(() => setItems(getMessages()));
    return () => { unsub(); };
  }, []);
  return items;
}
