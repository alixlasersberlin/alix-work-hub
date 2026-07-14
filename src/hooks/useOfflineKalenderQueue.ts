import { useEffect, useState, useCallback } from 'react';
import { countQueue, subscribeQueue, syncQueue, enqueueAction, type QueuedAction } from '@/lib/offline/kalender-queue';

/**
 * Zeigt Anzahl ausstehender Offline-Aktionen und synchronisiert automatisch,
 * sobald das Gerät wieder online ist.
 */
export function useOfflineKalenderQueue() {
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setCount(await countQueue());
  }, []);

  const runSync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: 0, failed: 0 };
    setSyncing(true);
    try { return await syncQueue(); }
    finally { setSyncing(false); await refresh(); }
  }, [refresh]);

  useEffect(() => {
    refresh();
    const unsub = subscribeQueue(refresh);
    const on = () => { setOnline(true); runSync(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    // beim Mount ggf. sofort abarbeiten
    if (typeof navigator !== 'undefined' && navigator.onLine) runSync();
    return () => {
      unsub();
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [refresh, runSync]);

  return { count, online, syncing, runSync, enqueue: enqueueAction as (a: QueuedAction) => Promise<number> };
}
