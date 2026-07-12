import { useCallback } from 'react';
import { toast } from 'sonner';
import { MOCK_APPOINTMENTS } from '@/lib/esc/mock-data';
import type { EscAppointment } from '@/lib/esc/types';
import { logEscAudit } from '@/lib/esc/audit';
import { useEscStore } from '@/lib/esc/store/kvStore';
import { supabase } from '@/integrations/supabase/client';

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
    // Frontend-Guard: nur Super Admin darf löschen (RLS erzwingt es zusätzlich serverseitig).
    const { data: isSuper } = await (supabase as any).rpc('has_role', { check_role: 'Super Admin' });
    if (!isSuper) {
      toast.error('Löschen nicht erlaubt – Termine dürfen ausschließlich von Super Admin gelöscht werden. Nutze stattdessen "Stornieren".');
      return;
    }
    await remove(id);
    await logEscAudit({ entity: 'appointment', entityId: id, action: 'delete', before, source: 'internal' });
  }, [items, remove]);

  return { appointments: items, createAppointment, updateAppointment, deleteAppointment };
}
