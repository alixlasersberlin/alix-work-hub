import { supabase } from '@/integrations/supabase/client';

export interface JournalPaymentInput {
  order_id?: string | null;
  order_number?: string | null;
  customer_id?: string | null;
  invoice_number?: string | null;
  reference?: string | null;
  amount_gross: number;
  amount_net?: number | null;
  amount_vat?: number | null;
  booking_date?: string | null; // yyyy-mm-dd
  description: string;
  source_table?: string | null;
  source_id?: string | null;
  vorgang?: string; // z.B. "Anzahlung", "Zahlung"
  payment_method?: string | null;
}

/**
 * Schreibt eine Zahlungsbuchung ins Buchungsjournal (finance_journal).
 * Duplikate werden anhand von source_id + vorgang vermieden.
 */
export async function postPaymentToJournal(input: JournalPaymentInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const bookingDate = (input.booking_date && input.booking_date.length >= 10)
      ? input.booking_date.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const bookingTime = new Date().toISOString().slice(11, 19);

    if (input.source_id && input.vorgang) {
      const { data: existing } = await supabase
        .from('finance_journal' as any)
        .select('id')
        .eq('source_id', input.source_id)
        .eq('vorgang', input.vorgang)
        .limit(1);
      if (existing && existing.length > 0) {
        return { ok: true };
      }
    }

    const { data: { user } } = await supabase.auth.getUser();

    const payload: any = {
      booking_date: bookingDate,
      booking_time: bookingTime,
      source_module: 'anzahlungen',
      source_table: input.source_table ?? null,
      source_id: input.source_id ?? null,
      reference: input.reference ?? input.invoice_number ?? null,
      order_number: input.order_number ?? null,
      invoice_number: input.invoice_number ?? null,
      customer_id: input.customer_id ?? null,
      vorgang: input.vorgang ?? 'Zahlung',
      amount_gross: Number(input.amount_gross) || 0,
      amount_net: input.amount_net != null ? Number(input.amount_net) : null,
      amount_vat: input.amount_vat != null ? Number(input.amount_vat) : null,
      payment_method: input.payment_method ?? null,
      description: input.description,
      status: 'gebucht',
      user_id: user?.id ?? null,
    };

    const { error } = await supabase.from('finance_journal' as any).insert(payload);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}
