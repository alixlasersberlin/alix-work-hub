import { useCallback, useEffect, useState } from 'react';
import { MOCK_RESOURCES } from '@/lib/esc/mock-data';
import type { EscResource } from '@/lib/esc/types';

let store: EscResource[] = [...MOCK_RESOURCES];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function useResources() {
  const [items, setItems] = useState<EscResource[]>(store);
  useEffect(() => {
    const l = () => setItems([...store]);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const upsertResource = useCallback(async (r: Partial<EscResource> & { name: string; type: EscResource['type'] }) => {
    if (r.id && store.find((x) => x.id === r.id)) {
      store = store.map((x) => (x.id === r.id ? { ...x, ...r } as EscResource : x));
    } else {
      store = [...store, { active: true, ...r, id: r.id || crypto.randomUUID() } as EscResource];
    }
    notify();
  }, []);

  const deleteResource = useCallback(async (id: string) => {
    store = store.filter((x) => x.id !== id);
    notify();
  }, []);

  return { resources: items, upsertResource, deleteResource };
}
