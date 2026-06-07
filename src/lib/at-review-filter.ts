import { supabase } from '@/integrations/supabase/client';

/**
 * Begrenzt eine Liste mit `order_id`-Bezug auf Aufträge des Mandanten
 * Alix Austria (`source_system='zoho_eu_2'`). Wird von Bewertungs-Listen
 * verwendet, damit die Rolle „Österreich" nur AT-Bewertungen sieht.
 */
export async function filterAtOnlyByOrderId<T extends { order_id?: string | null }>(rows: T[]): Promise<T[]> {
  if (!rows.length) return rows;
  const ids = Array.from(new Set(rows.map(r => r.order_id).filter(Boolean))) as string[];
  if (!ids.length) return [];
  const PAGE = 500;
  const atSet = new Set<string>();
  for (let i = 0; i < ids.length; i += PAGE) {
    const slice = ids.slice(i, i + PAGE);
    const { data } = await (supabase as any)
      .from('orders')
      .select('id')
      .in('id', slice)
      .eq('source_system', 'zoho_eu_2');
    (data ?? []).forEach((o: any) => atSet.add(o.id));
  }
  return rows.filter(r => r.order_id && atSet.has(r.order_id));
}
