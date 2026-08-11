import { useCallback, useMemo } from 'react';
import { useEscStore } from '@/lib/esc/store/kvStore';
import { MOCK_APPOINTMENT_KINDS, type EscAppointmentKind } from '@/lib/esc/appointment-kinds';
import { VIP_TRAINING_KIND } from '@/lib/esc/vip-kind';

export function useAppointmentKinds() {
  const { items, upsert, remove } = useEscStore<EscAppointmentKind>({
    table: 'esc_store_appointment_kinds',
    getId: (k) => k.id,
    seed: MOCK_APPOINTMENT_KINDS,
  });

  // "Schulung VIP" ist immer verfügbar, auch in bereits bestehenden Datenbeständen.
  const allItems = useMemo(() => {
    if (items.some((k) => k.name === VIP_TRAINING_KIND)) return items;
    const vip = MOCK_APPOINTMENT_KINDS.find((k) => k.name === VIP_TRAINING_KIND);
    return vip ? [...items, vip] : items;
  }, [items]);


  const createKind = useCallback(async (k: Omit<EscAppointmentKind, 'id'>) => {
    const item: EscAppointmentKind = { ...k, id: crypto.randomUUID() };
    await upsert(item);
    return item;
  }, [upsert]);

  const updateKind = useCallback(async (id: string, patch: Partial<EscAppointmentKind>) => {
    const cur = allItems.find((x) => x.id === id);
    if (!cur) return;
    await upsert({ ...cur, ...patch });
  }, [allItems, upsert]);

  const deleteKind = useCallback(async (id: string) => { await remove(id); }, [remove]);

  return { kinds: allItems, createKind, updateKind, deleteKind };
}
