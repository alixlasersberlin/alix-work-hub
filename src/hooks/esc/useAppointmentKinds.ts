import { useCallback } from 'react';
import { useEscStore } from '@/lib/esc/store/kvStore';
import { MOCK_APPOINTMENT_KINDS, type EscAppointmentKind } from '@/lib/esc/appointment-kinds';

export function useAppointmentKinds() {
  const { items, upsert, remove } = useEscStore<EscAppointmentKind>({
    table: 'esc_store_appointment_kinds',
    getId: (k) => k.id,
    seed: MOCK_APPOINTMENT_KINDS,
  });

  const createKind = useCallback(async (k: Omit<EscAppointmentKind, 'id'>) => {
    const item: EscAppointmentKind = { ...k, id: crypto.randomUUID() };
    await upsert(item);
    return item;
  }, [upsert]);

  const updateKind = useCallback(async (id: string, patch: Partial<EscAppointmentKind>) => {
    const cur = items.find((x) => x.id === id);
    if (!cur) return;
    await upsert({ ...cur, ...patch });
  }, [items, upsert]);

  const deleteKind = useCallback(async (id: string) => { await remove(id); }, [remove]);

  return { kinds: items, createKind, updateKind, deleteKind };
}
