import { useCallback, useEffect, useState } from 'react';
import { MOCK_DEPARTMENTS } from '@/lib/esc/mock-data';
import type { EscDepartment } from '@/lib/esc/types';

const STORAGE_KEY = 'esc.departments.v2';

function normalizeDepartment(value: Partial<EscDepartment> | null | undefined): EscDepartment | null {
  if (!value || typeof value.id !== 'string' || typeof value.name !== 'string') return null;

  const duration = Number(value.defaultDurationMinutes);

  return {
    id: value.id,
    name: value.name,
    color: typeof value.color === 'string' && value.color.trim() ? value.color : 'hsl(var(--primary))',
    icon: typeof value.icon === 'string' && value.icon.trim() ? value.icon : 'Circle',
    description: typeof value.description === 'string' ? value.description : '',
    active: typeof value.active === 'boolean' ? value.active : true,
    publicBookable: typeof value.publicBookable === 'boolean' ? value.publicBookable : false,
    defaultDurationMinutes: Number.isFinite(duration) && duration > 0 ? duration : 60,
    defaultEmailTemplate: typeof value.defaultEmailTemplate === 'string' ? value.defaultEmailTemplate : '',
    responsibleEmployeeIds: Array.isArray(value.responsibleEmployeeIds)
      ? value.responsibleEmployeeIds.filter((id): id is string => typeof id === 'string')
      : [],
    internalVisible: typeof value.internalVisible === 'boolean' ? value.internalVisible : true,
    externallyBookable: typeof value.externallyBookable === 'boolean' ? value.externallyBookable : false,
  };
}

function readDepartments(): EscDepartment[] {
  if (typeof window === 'undefined') return [...MOCK_DEPARTMENTS];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = MOCK_DEPARTMENTS.map((department) => ({ ...department }));
      writeDepartments(seeded);
      return seeded;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...MOCK_DEPARTMENTS];

    const normalized = parsed.map(normalizeDepartment).filter((item): item is EscDepartment => !!item);
    return normalized.length ? normalized : [...MOCK_DEPARTMENTS];
  } catch {
    return [...MOCK_DEPARTMENTS];
  }
}

function writeDepartments(items: EscDepartment[]) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

let store: EscDepartment[] = readDepartments();
const listeners = new Set<() => void>();
const notify = () => {
  writeDepartments(store);
  listeners.forEach((l) => l());
};

export function useDepartments() {
  const [items, setItems] = useState<EscDepartment[]>(store);
  useEffect(() => {
    const l = () => setItems([...store]);
    listeners.add(l);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      store = readDepartments();
      setItems([...store]);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener('storage', onStorage);
    };
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
