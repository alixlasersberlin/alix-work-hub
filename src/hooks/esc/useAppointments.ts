import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MOCK_APPOINTMENTS } from '@/lib/esc/mock-data';
import type { EscAppointment, EscStatus, EscPriority } from '@/lib/esc/types';
import { logEscAudit } from '@/lib/esc/audit';
import { useEscStore } from '@/lib/esc/store/kvStore';
import { supabase } from '@/integrations/supabase/client';

/** Map ein esc_events-Row auf das UI-Modell EscAppointment (read-only). */
function eventRowToAppointment(row: any): EscAppointment {
  const statusMap: Record<string, EscStatus> = {
    planned: 'geplant',
    scheduled: 'geplant',
    confirmed: 'bestaetigt',
    in_progress: 'geplant',
    completed: 'abgeschlossen',
    cancelled: 'storniert',
    bestaetigung_ausstehend: 'bestaetigung_offen',
    geplant: 'geplant',
    bestaetigt: 'bestaetigt',
    storniert: 'storniert',
    abgeschlossen: 'abgeschlossen',
  };
  const prioMap: Record<string, EscPriority> = {
    low: 'low', niedrig: 'low',
    normal: 'normal',
    high: 'high', hoch: 'high',
    urgent: 'urgent', kritisch: 'urgent',
  };
  const rawStatus = (row.appointment_status || row.status || 'planned').toString().toLowerCase();
  const rawPrio = (row.priority || 'normal').toString().toLowerCase();
  return {
    id: row.id,
    title: row.title || 'Termin',
    description: row.description ?? undefined,
    startAt: row.start_at,
    endAt: row.end_at ?? row.start_at,
    departmentId: row.department_id ?? '',
    kind: row.event_kind ?? undefined,
    employeeIds: row.assigned_user_id ? [row.assigned_user_id] : [],
    customerName: row.customer_name ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    customerPhone: row.customer_phone ?? undefined,
    address: row.address ?? undefined,
    location: row.location ?? undefined,
    resourceId: row.resource_id ?? undefined,
    deviceId: row.device_id ?? undefined,
    status: statusMap[rawStatus] ?? 'geplant',
    priority: prioMap[rawPrio] ?? 'normal',
    internalNote: row.internal_note ?? undefined,
    externalNote: row.external_note ?? undefined,
    confirmationRequired: !!row.requires_confirmation,
    confirmationToken: row.confirmation_token ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

export function useAppointments() {
  const { items, upsert, remove } = useEscStore<EscAppointment>({
    table: 'esc_store_appointments',
    getId: (a) => a.id,
    seed: MOCK_APPOINTMENTS,
  });

  // Zusätzlich: aus esc_events (Ticket-Termine u.a.) lesen und mergen.
  const [eventAppointments, setEventAppointments] = useState<EscAppointment[]>([]);

  const loadEvents = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('esc_events')
      .select('*')
      .is('deleted_at', null)
      .order('start_at', { ascending: true })
      .limit(1000);
    if (error) {
      console.warn('esc_events load failed', error.message);
      return;
    }
    setEventAppointments(((data as any[]) || []).map(eventRowToAppointment));
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  useEffect(() => {
    const channel = (supabase as any)
      .channel('esc-calendar-events-merge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'esc_events' }, () => loadEvents())
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [loadEvents]);

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
    // esc_events-Einträge: direkt in DB updaten
    const fromEvents = eventAppointments.find((a) => a.id === id);
    if (fromEvents) {
      const dbPatch: Record<string, unknown> = {};
      if (patch.startAt) dbPatch.start_at = patch.startAt;
      if (patch.endAt) dbPatch.end_at = patch.endAt;
      if (patch.title) dbPatch.title = patch.title;
      if (patch.status) dbPatch.appointment_status = patch.status;
      dbPatch.updated_at = new Date().toISOString();
      const { error } = await (supabase as any).from('esc_events').update(dbPatch).eq('id', id);
      if (error) { toast.error('Aktualisierung fehlgeschlagen: ' + error.message); return null; }
      await loadEvents();
      return { ...fromEvents, ...patch, updatedAt: dbPatch.updated_at as string };
    }
    const before = items.find((a) => a.id === id);
    if (!before) return null;
    const after = { ...before, ...patch, updatedAt: new Date().toISOString() };
    await upsert(after);
    await logEscAudit({ entity: 'appointment', entityId: id, action: 'update', before, after, source: 'internal' });
    return after;
  }, [items, upsert, eventAppointments, loadEvents]);

  const deleteAppointment = useCallback(async (id: string) => {
    const before = items.find((a) => a.id === id);
    // Frontend-Guard: nur Super Admin darf löschen (RLS erzwingt es zusätzlich serverseitig).
    const { data: isSuper } = await (supabase as any).rpc('has_role', { check_role: 'Super Admin' });
    if (!isSuper) {
      toast.error('Löschen nicht erlaubt – Termine dürfen ausschließlich von Super Admin gelöscht werden. Nutze stattdessen "Stornieren".');
      return;
    }
    if (eventAppointments.some((a) => a.id === id)) {
      await (supabase as any).from('esc_events').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      await loadEvents();
      return;
    }
    await remove(id);
    await logEscAudit({ entity: 'appointment', entityId: id, action: 'delete', before, source: 'internal' });
  }, [items, remove, eventAppointments, loadEvents]);

  // Merge: KV-Store-Termine + esc_events-Termine (dedupe per id)
  const merged: EscAppointment[] = [
    ...items,
    ...eventAppointments.filter((e) => !items.some((i) => i.id === e.id)),
  ];

  return { appointments: merged, createAppointment, updateAppointment, deleteAppointment };
}
