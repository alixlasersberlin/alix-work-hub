import { supabase } from '@/integrations/supabase/client';

/**
 * Verteilt einen bestätigten Anzahlungsbetrag auf die offenen
 * Anzahlungsrechnungen (finance_deposits) eines Auftrags – FIFO nach Nummer.
 * Vollständig gedeckte Rechnungen werden auf "bezahlt", teilweise gedeckte
 * auf "teilbezahlt" gesetzt.
 */
export async function settleDepositInvoices(
  orderId: string,
  amountGross: number,
): Promise<{ ok: boolean; settled: string[]; error?: string }> {
  try {
    if (!orderId || !(Number(amountGross) > 0)) return { ok: true, settled: [] };

    const { data, error } = await supabase
      .from('finance_deposits' as any)
      .select('id, deposit_number, gross_amount, paid_amount, status')
      .eq('order_id', orderId)
      .order('deposit_number', { ascending: true });
    if (error) return { ok: false, settled: [], error: error.message };

    let remaining = Number(amountGross);
    const settled: string[] = [];

    for (const row of (data ?? []) as any[]) {
      if (remaining <= 0.009) break;
      const gross = Number(row.gross_amount) || 0;
      const paid = Number(row.paid_amount) || 0;
      const open = gross - paid;
      if (open <= 0.009) continue;

      const apply = Math.min(open, remaining);
      const newPaid = paid + apply;
      const fullyPaid = gross - newPaid <= 0.009;

      const { error: upErr } = await supabase
        .from('finance_deposits' as any)
        .update({
          paid_amount: newPaid,
          status: fullyPaid ? 'bezahlt' : 'teilbezahlt',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', row.id);
      if (upErr) return { ok: false, settled, error: upErr.message };

      remaining -= apply;
      settled.push(row.deposit_number);
    }

    return { ok: true, settled };
  } catch (e: any) {
    return { ok: false, settled: [], error: e?.message ?? String(e) };
  }
}
