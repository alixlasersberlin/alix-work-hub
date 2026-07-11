import { useCallback, useEffect, useState } from 'react';
import { MOCK_EMPLOYEES } from '@/lib/esc/mock-data';
import type { EscEmployee } from '@/lib/esc/types';

const LS_KEY = 'esc.employees.v1';

const load = (): EscEmployee[] => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [...MOCK_EMPLOYEES];
};
const save = (list: EscEmployee[]) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
};

let store: EscEmployee[] = load();
const listeners = new Set<() => void>();
const notify = () => { save(store); listeners.forEach((l) => l()); };

export function useEmployees() {
  const [items, setItems] = useState<EscEmployee[]>(store);
  useEffect(() => {
    const l = () => setItems([...store]);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const upsertEmployee = useCallback(async (e: Partial<EscEmployee> & { id?: string; name: string; email: string; role: string; departmentIds: string[] }) => {
    if (e.id && store.find((x) => x.id === e.id)) {
      store = store.map((x) => (x.id === e.id ? { ...x, ...e } as EscEmployee : x));
    } else {
      const item: EscEmployee = {
        active: true, publicBookable: false,
        ...e, id: e.id || crypto.randomUUID(),
      } as EscEmployee;
      store = [...store, item];
    }
    notify();
  }, []);

  const deleteEmployee = useCallback(async (id: string) => {
    store = store.filter((x) => x.id !== id);
    notify();
  }, []);

  return { employees: items, upsertEmployee, deleteEmployee };
}
