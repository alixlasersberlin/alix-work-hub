import { useCallback, useEffect, useState } from 'react';
import { MOCK_DEPARTMENTS } from '@/lib/esc/mock-data';
import type { EscDepartment } from '@/lib/esc/types';

let store: EscDepartment[] = [...MOCK_DEPARTMENTS];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function useDepartments() {
  const [items, setItems] = useState<EscDepartment[]>(store);
  useEffect(() => {
    const l = () => setItems([...store]);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const createDepartment = useCallback(async (d: Omit<EscDepartment, 'id'>) => {
    const item: EscDepartment = { ...d, id: crypto.randomUUID() };
    store = [...store, item];
    notify();
    return item;
  }, []);
  const updateDepartment = useCallback(async (id: string, patch: Partial<EscDepartment>) => {
    store = store.map((x) => (x.id === id ? { ...x, ...patch } : x));
    notify();
  }, []);
  const deleteDepartment = useCallback(async (id: string) => {
    store = store.filter((x) => x.id !== id);
    notify();
  }, []);

  return { departments: items, createDepartment, updateDepartment, deleteDepartment };
}
