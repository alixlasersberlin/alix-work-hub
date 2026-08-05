import { supabase } from '@/integrations/supabase/client';

export interface OpenInvoice {
  id: string;
  invoice_number: string | null;
  reference_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  invoice_date: string | null;
  due_date: string | null;
  currency: string | null;
  total: number | null;
  balance: number | null;
  status: string | null;
  payment_status: string | null;
  /** Quelle: normale Zoho-Rechnung, Ratenrechnung (wiederkehrend) oder nicht fakturierter Auftrag */
  source?: 'zoho' | 'recurring' | 'order';
}

export interface MatchCandidate {
  invoice: OpenInvoice;
  score: number;
  reasons: string[];
}

const norm = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

const INV_COLS =
  'id,invoice_number,reference_number,customer_id,customer_name,invoice_date,due_date,currency,total,balance,status,payment_status';

/** Lädt offene Aufträge ohne Rechnung (Saldo = offener/Gesamtbetrag) als Zuordnungs-Kandidaten. */
export async function loadOpenOrders(region: 'EU' | 'CH', limit = 1000): Promise<OpenInvoice[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id,order_number,customer_id,currency,total_amount,finance_open_amount,finance_remaining_amount,order_date,order_status,customers:customer_id(company_name,contact_name)')
    .eq('accounting_region', region as any)
    .order('order_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as any[])
    .map(o => {
      const open = Number(o.finance_open_amount ?? o.finance_remaining_amount ?? o.total_amount ?? 0);
      return {
        id: o.id,
        invoice_number: o.order_number,
        reference_number: o.order_number,
        customer_id: o.customer_id,
        customer_name: o.customers?.company_name || o.customers?.contact_name || null,
        invoice_date: o.order_date ? String(o.order_date).slice(0, 10) : null,
        due_date: null,
        currency: o.currency || (region === 'CH' ? 'CHF' : 'EUR'),
        total: Number(o.total_amount ?? 0),
        balance: open,
        status: o.order_status,
        payment_status: 'Auftrag',
        source: 'order' as const,
      } as OpenInvoice;
    })
    .filter(o => Number(o.balance ?? 0) > 0);
}

/** Lädt offene Rechnungen einer Buchhaltungsregion (Saldo > 0) inkl. Ratenrechnungen und offener Aufträge. */
export async function loadOpenInvoices(region: 'EU' | 'CH', limit = 2000): Promise<OpenInvoice[]> {
  const [std, rec, orders] = await Promise.all([
    supabase
      .from('zoho_invoices')
      .select(INV_COLS)
      .eq('accounting_region', region as any)
      .gt('balance', 0)
      .not('status', 'in', '("void","cancelled","storniert")')
      .order('invoice_date', { ascending: false })
      .limit(limit),
    supabase
      .from('zoho_recurring_invoices')
      .select(INV_COLS)
      .eq('accounting_region', region as any)
      .gt('balance', 0)
      .not('status', 'in', '("void","cancelled","storniert")')
      .order('invoice_date', { ascending: false })
      .limit(limit),
    loadOpenOrders(region).catch(() => [] as OpenInvoice[]),
  ]);
  if (std.error) throw std.error;
  return [
    ...((std.data ?? []) as any[]).map(i => ({ ...i, source: 'zoho' as const })),
    ...((rec.data ?? []) as any[]).map(i => ({ ...i, source: 'recurring' as const })),
    ...orders,
  ] as OpenInvoice[];
}


interface TxLike {
  amount: number;
  currency: string;
  purpose?: string | null;
  booking_text?: string | null;
  sender_receiver_name?: string | null;
  sender_receiver_iban?: string | null;
  end_to_end_reference?: string | null;
  bank_reference?: string | null;
  customer_reference?: string | null;
}

/** Bewertet eine Bankbuchung gegen offene Rechnungen. */
export function scoreInvoices(
  tx: TxLike,
  invoices: OpenInvoice[],
  ibanCustomerIds: Set<string> = new Set(),
  learnedCustomerId?: string | null,
): MatchCandidate[] {
  const hay = norm(`${tx.purpose ?? ''} ${tx.booking_text ?? ''} ${tx.end_to_end_reference ?? ''} ${tx.customer_reference ?? ''} ${tx.bank_reference ?? ''}`);
  const hayRaw = `${tx.purpose ?? ''} ${tx.booking_text ?? ''} ${tx.end_to_end_reference ?? ''}`.toLowerCase();
  const payer = norm(tx.sender_receiver_name);
  const abs = Math.abs(tx.amount);
  const results: MatchCandidate[] = [];

  for (const inv of invoices) {
    if (inv.currency && tx.currency && inv.currency.toUpperCase() !== tx.currency.toUpperCase()) continue;
    let score = 0;
    const reasons: string[] = [];
    const num = inv.invoice_number ?? '';
    const numN = norm(num);

    if (numN && numN.length >= 4 && hay.includes(numN)) {
      score += 55; reasons.push(`Rechnungsnummer ${num} im Verwendungszweck`);
    } else if (numN.length >= 5) {
      const tail = numN.slice(-5);
      if (hay.includes(tail)) { score += 25; reasons.push(`Teil der Rechnungsnummer (${tail}) erkannt`); }
    }
    if (inv.reference_number && norm(inv.reference_number).length >= 4 && hay.includes(norm(inv.reference_number))) {
      score += 20; reasons.push(`Auftrags-/Referenznummer ${inv.reference_number} erkannt`);
    }

    const bal = Number(inv.balance ?? 0);
    const total = Number(inv.total ?? 0);
    if (bal > 0 && Math.abs(bal - abs) < 0.01) { score += 30; reasons.push('Offener Betrag stimmt exakt überein'); }
    else if (total > 0 && Math.abs(total - abs) < 0.01) { score += 22; reasons.push('Rechnungsbetrag stimmt exakt überein'); }
    else if (bal > 0 && abs < bal) { score += 6; reasons.push('Teilzahlung möglich'); }
    else if (bal > 0 && abs > bal) { score += 3; reasons.push('Überzahlung möglich'); }

    const cname = norm(inv.customer_name);
    if (cname && payer) {
      if (cname === payer) { score += 20; reasons.push('Kundenname stimmt überein'); }
      else if (cname.length > 4 && (payer.includes(cname) || cname.includes(payer))) { score += 14; reasons.push('Kundenname ähnlich'); }
    }
    if (cname && cname.length > 4 && hay.includes(cname)) { score += 8; reasons.push('Kundenname im Buchungstext'); }
    if (inv.customer_id && ibanCustomerIds.has(inv.customer_id)) { score += 15; reasons.push('IBAN ist dem Kunden zugeordnet'); }
    if (inv.customer_id && hayRaw.includes(String(inv.customer_id).toLowerCase())) { score += 10; reasons.push('Kundennummer erkannt'); }
    if (learnedCustomerId && inv.customer_id && inv.customer_id === learnedCustomerId) {
      score += 18; reasons.push('Gelernte Regel: Zahler war bereits diesem Kunden zugeordnet');
    }
    if (inv.due_date) {
      const d = new Date(inv.due_date).getTime();
      if (isFinite(d) && Math.abs(Date.now() - d) < 1000 * 60 * 60 * 24 * 60) { score += 2; reasons.push('Fälligkeit im Zeitfenster'); }
    }

    if (inv.source === 'order') {
      score = Math.max(0, score - 5);
      if (score > 0) reasons.push('Auftrag ohne Rechnung');
    }
    if (score > 0) results.push({ invoice: inv, score: Math.min(100, score), reasons });
  }

  results.sort((a, b) => b.score - a.score);
  // Eindeutiger Betrag als Bonus, wenn genau eine Rechnung exakt passt
  const exact = results.filter(r => Math.abs(Number(r.invoice.balance ?? 0) - abs) < 0.01);
  if (exact.length === 1 && exact[0].score < 95) {
    exact[0].score = Math.min(100, exact[0].score + 10);
    exact[0].reasons.push('Betrag ist eindeutig');
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 8);
}

export function scoreColor(score: number): 'gruen' | 'gelb' | 'rot' {
  if (score >= 95) return 'gruen';
  if (score >= 75) return 'gelb';
  return 'rot';
}
