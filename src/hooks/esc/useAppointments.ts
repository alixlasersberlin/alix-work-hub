import { useCallback } from 'react';
import { MOCK_APPOINTMENTS } from '@/lib/esc/mock-data';
import type { EscAppointment } from '@/lib/esc/types';
import { logEscAudit } from '@/lib/esc/audit';
import { useEscStore } from '@/lib/esc/store/kvStore';

export function useAppointments() {
  const { items, upsert, remove } = useEscStore<EscAppointment>({
    table: 'esc_store_appointments',
    getId: (a) => a.id,
    seed: MOCK_APPOINTMENTS,
  });

  const createAppointment = useCallback(async (payload: Omit<EscAppointment, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const item: EscAppointment = {
      ...payload,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      confirmationToken: payload.confirmationRequired ? crypto.randomUUID().replace(/-/g, '') : undefined,
    };
    await upsert(item);
    await logEscAudit({ entity: 'appointment', entityId: item.id, action: 'create', after: item, source: 'internal' });
    return item;
  }, [upsert]);

  const updateAppointment = useCallback(async (id: string, patch: Partial<EscAppointment>) => {
    const before = items.find((a) => a.id === id);
    if (!before) return null;
    const after = { ...before, ...patch, updatedAt: new Date().toISOString() };
    await upsert(after);
    await logEscAudit({ entity: 'appointment', entityId: id, action: 'update', before, after, source: 'internal' });
    return after;
  }, [items, upsert]);

  const deleteAppointment = useCallback(async (id: string) => {
    const before = items.find((a) => a.id === id);
    await remove(id);
    await logEscAudit({ entity: 'appointment', entityId: id, action: 'delete', before, source: 'internal' });
  }, [items, remove]);

  return { appointments: items, createAppointment, updateAppointment, deleteAppointment };
}
