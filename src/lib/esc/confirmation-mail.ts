import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { EscAppointment } from '@/lib/esc/types';

/** Kopie aller Terminbestätigungen geht immer an support@alix-lasers.com. */
export const ESC_CONFIRMATION_COPY = 'support@alix-lasers.com';

export async function sendAppointmentConfirmationMail(a: Partial<EscAppointment>): Promise<{ ok: boolean; error?: string }> {
  if (!a?.customerEmail) return { ok: false, error: 'Keine Kunden-E-Mail hinterlegt' };
  const { data, error } = await supabase.functions.invoke('esc-appointment-confirmation-mail', {
    body: {
      appointment_id: a.id ?? null,
      recipient_email: a.customerEmail,
      customer_name: a.customerContact || a.customerName || '',
      title: a.title || 'Termin',
      description: a.description || '',
      start_at: a.startAt,
      end_at: a.endAt,
      location: a.location || '',
      address: a.address || '',
    },
  });
  if (error) {
    let details = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        details = String(body?.error || body?.details || error.message);
      } catch {
        try { details = await error.context.text(); } catch { /* keep SDK message */ }
      }
    }
    return { ok: false, error: details };
  }
  if ((data as any)?.error) return { ok: false, error: String((data as any).error) };
  return { ok: true };
}
