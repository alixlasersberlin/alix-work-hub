import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface KalenderEvent {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  timezone: string | null;
  all_day: boolean;
  department_id: string | null;
  event_type_id: string | null;
  event_kind: string | null;
  status: string | null;
  appointment_status: string | null;
  priority: string | null;
  location: string | null;
  address: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  contact_person: string | null;
  assigned_user_id: string | null;
  internal_note: string | null;
  external_note: string | null;
  requires_confirmation: boolean | null;
  confirmation_status: string | null;
  ticket_id: string | null;
  room_id: string | null;
  resource_id: string | null;
  device_id: string | null;
  vehicle_id: string | null;
}

interface Options {
  from: Date;
  to: Date;
  onlyMine?: boolean;
}

/**
 * Liest Termine direkt aus dem bestehenden AlixWork-Teamkalender (esc_events).
 * Kein Fork, kein zweiter Datenbestand. RLS filtert serverseitig.
 */
export function useKalenderEvents({ from, to, onlyMine = false }: Options) {
  const { user } = useAuth();
  const [events, setEvents] = useState<KalenderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    let q = (supabase as any)
      .from('esc_events')
      .select('*')
      .is('deleted_at', null)
      .gte('start_at', from.toISOString())
      .lte('start_at', to.toISOString())
      .order('start_at', { ascending: true })
      .limit(500);
    if (onlyMine && user?.id) q = q.eq('assigned_user_id', user.id);
    const { data, error } = await q;
    if (error) setError(error.message);
    setEvents(((data as any) || []) as KalenderEvent[]);
    setLoading(false);
  }, [from.getTime(), to.getTime(), onlyMine, user?.id]);

  useEffect(() => { load(); }, [load]);

  // Realtime: sofortige Updates
  useEffect(() => {
    const channel = (supabase as any)
      .channel('mobile-kalender-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'esc_events' }, () => {
        load();
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [load]);

  return { events, loading, error, reload: load };
}

export async function loadEvent(id: string): Promise<KalenderEvent | null> {
  const { data } = await (supabase as any).from('esc_events').select('*').eq('id', id).maybeSingle();
  return (data as any) || null;
}

export async function confirmEvent(id: string, status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled') {
  const { error } = await (supabase as any)
    .from('esc_events')
    .update({ status, appointment_status: status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
