import { useCallback, useEffect, useState } from 'react';
import { MOCK_APPOINTMENTS } from '@/lib/esc/mock-data';
import type { EscAppointment } from '@/lib/esc/types';
import { logEscAudit } from '@/lib/esc/audit';

// In-memory store for Prompt 1. Prompt 2 replaces this with a Supabase-backed store.
let store: EscAppointment[] = [...MOCK_APPOINTMENTS];
const listeners = new Set<() => void>();
function notify() { listeners.forEach((l) => l()); }

export function useAppointments() {
  const [items, setItems] = useState<EscAppointment[]>(store);

  useEffect(() => {
    const l = () => setItems([...store]);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const createAppointment = useCallback(async (payload: Omit<EscAppointment, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const item: EscAppointment = {
      ...payload,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      confirmationToken: payload.confirmationRequired ? crypto.randomUUID().replace(/-/g, '') : undefined,
    };
    store = [item, ...store];
    await logEscAudit({ entity: 'appointment', entityId: item.id, action: 'create', after: item, source: 'internal' });
    notify();
    return item;
  }, []);

  const updateAppointment = useCallback(async (id: string, patch: Partial<EscAppointment>) => {
    const before = store.find((a) => a.id === id);
    if (!before) return null;
    const after = { ...before, ...patch, updatedAt: new Date().toISOString() };
    store = store.map((a) => (a.id === id ? after : a));
    await logEscAudit({ entity: 'appointment', entityId: id, action: 'update', before, after, source: 'internal' });
    notify();
    return after;
  }, []);

  const deleteAppointment = useCallback(async (id: string) => {
    const before = store.find((a) => a.id === id);
    store = store.filter((a) => a.id !== id);
    await logEscAudit({ entity: 'appointment', entityId: id, action: 'delete', before, source: 'internal' });
    notify();
  }, []);

  return { appointments: items, createAppointment, updateAppointment, deleteAppointment };
}
