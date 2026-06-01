import { supabase } from '@/integrations/supabase/client';

/**
 * Sendet eine Bewertungseinladung für einen Auftrag.
 * Auto: beim Statuswechsel auf "geliefert". Manuell: durch Super Admin.
 * Fehler werden geloggt aber niemals weitergeworfen, damit sie den
 * eigentlichen Statuswechsel-Flow nicht unterbrechen.
 */
export async function sendReviewInvitation(
  orderId: string,
  opts: { manual?: boolean } = {},
): Promise<{ ok: boolean; message?: string; review_url?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-review-invitation', {
      body: { order_id: orderId, manual: !!opts.manual },
    });
    if (error) return { ok: false, message: error.message };
    if ((data as any)?.error) return { ok: false, message: (data as any).error };
    return { ok: true, message: (data as any)?.message, review_url: (data as any)?.review_url };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Unbekannter Fehler' };
  }
}
