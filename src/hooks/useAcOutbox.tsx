import { useEffect, useState } from 'react';
import { list, subscribe, startAutoSync, AcOutboxItem } from '@/lib/connect/offline-outbox';

export function useAcOutbox() {
  const [items, setItems] = useState<AcOutboxItem[]>([]);
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    startAutoSync();
    const refresh = () => { list().then(setItems).catch(() => {}); };
    refresh();
    const unsub = subscribe(refresh);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      unsub();
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return { items, online };
}
