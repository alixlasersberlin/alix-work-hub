import { supabase } from '@/integrations/supabase/client';

// Marker note types used to flag a "Teilgeliefert" order that should
// re-appear in BESTELLUNGEN / Bestellung möglich for the remaining items.
export const RESTBESTELLUNG_PENDING = 'restbestellung_pending';
export const RESTBESTELLUNG_DONE = 'restbestellung_done';

export async function hasPendingRestbestellung(orderId: string): Promise<boolean> {
  const { data } = await supabase
    .from('order_notes')
    .select('id')
    .eq('order_id', orderId)
    .eq('note_type', RESTBESTELLUNG_PENDING)
    .limit(1);
  return !!(data && data.length);
}

export async function createRestbestellungMarker(orderId: string): Promise<{ error: string | null }> {
  // Avoid duplicates
  if (await hasPendingRestbestellung(orderId)) return { error: null };
  const { error } = await supabase.from('order_notes').insert({
    order_id: orderId,
    note_type: RESTBESTELLUNG_PENDING,
    note_text: 'Restbestellung in „Bestellung möglich" übernommen (Teilgeliefert).',
    is_internal: true,
  });
  return { error: error?.message ?? null };
}

export async function markRestbestellungDone(orderId: string): Promise<void> {
  await supabase
    .from('order_notes')
    .update({ note_type: RESTBESTELLUNG_DONE })
    .eq('order_id', orderId)
    .eq('note_type', RESTBESTELLUNG_PENDING);
}

export async function fetchPendingRestbestellungOrderIds(): Promise<Set<string>> {
  const { data } = await supabase
    .from('order_notes')
    .select('order_id')
    .eq('note_type', RESTBESTELLUNG_PENDING);
  return new Set(((data ?? []) as any[]).map(r => r.order_id));
}
