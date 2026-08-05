import { supabase } from '@/integrations/supabase/client';
import { logBank } from './api';

const T = (n: string) => supabase.from(n as any);

/* ------------------------------------------------------------ Erkennung */

export const RETURN_DEBIT_KEYWORDS = [
  'rücklastschrift', 'ruecklastschrift',
  'lastschrift nicht eingelöst', 'lastschrift nicht eingeloest',
  'lastschrift zurück', 'lastschrift zurueck',
  'rückgabe lastschrift', 'rueckgabe lastschrift',
  'sepa-rückgabe', 'sepa-rueckgabe', 'sepa rückgabe', 'sepa rueckgabe',
  'rückbuchung', 'rueckbuchung',
  'chargeback', 'widerspruch',
  'kontodeckung nicht ausreichend', 'keine kontodeckung',
  'konto erloschen', 'konto gesperrt',
  'retoure lastschrift', 'unpaid', 'nicht eingelöst', 'nicht eingeloest',
];

/** SEPA-Rückgabecodes mit Klartext-Grund */
export const RETURN_CODES: Record<string, string> = {
  AC01: 'Kontonummer / IBAN fehlerhaft',
  AC04: 'Konto erloschen',
  AC06: 'Konto gesperrt',
  AM04: 'Kontodeckung nicht ausreichend',
  MD01: 'Kein gültiges Mandat / nicht autorisiert',
  MD06: 'Widerspruch des Kunden',
  MS02: 'Vom Kunden abgelehnt',
  SL01: 'Serviceanweisung der Bank (Lastschriftsperre)',
};

export interface ReturnDetection {
  detected: boolean;
  code: string | null;
  reason: string | null;
  keyword: string | null;
}

export function detectReturnDebit(tx: {
  booking_text?: string | null; purpose?: string | null; raw_data?: any; amount?: number | string;
}): ReturnDetection {
  const hay = `${tx.booking_text ?? ''} ${tx.purpose ?? ''} ${JSON.stringify(tx.raw_data ?? {})}`;
  const low = hay.toLowerCase();
  const keyword = RETURN_DEBIT_KEYWORDS.find(w => low.includes(w)) ?? null;
  const code = Object.keys(RETURN_CODES).find(c => new RegExp(`(^|[^A-Z0-9])${c}([^A-Z0-9]|$)`).test(hay.toUpperCase())) ?? null;
  return {
    detected: !!keyword || !!code,
    code,
    reason: code ? RETURN_CODES[code] : (keyword ? keyword : null),
    keyword,
  };
}

/* ------------------------------------------------------------ Statuswerte */

export const RD_STATUS: Record<string, string> = {
  erkannt: 'Rücklastschrift erkannt',
  pruefung: 'Prüfung erforderlich',
  zahlung_gefunden: 'Ursprüngliche Zahlung gefunden',
  manuell_zugeordnet: 'Manuell zugeordnet',
  bestaetigt: 'Bestätigt',
  rechnung_geoeffnet: 'Rechnung wieder geöffnet',
  teilruecklastschrift: 'Teilrücklastschrift',
  vollstaendig: 'Vollständig zurückgebucht',
  gebuehren_offen: 'Gebühren offen',
  gebuehren_berechnet: 'Gebühren berechnet',
  zahlung_ausstehend: 'Erneute Zahlung ausstehend',
  mahnprozess: 'Im Mahnprozess',
  ungeklaert: 'Ungeklärt',
  doppelt: 'Doppelte Rücklastschrift',
  bankfehler: 'Bankfehler',
  storniert: 'Storniert',
  erledigt: 'Erledigt',
};

/* ------------------------------------------------------------ Datensätze */

export async function getReturnDebitByTx(txId: string) {
  const { data, error } = await T('bank_return_debits').select('*').eq('bank_transaction_id', txId).maybeSingle();
  if (error) throw error;
  return data as any | null;
}

export async function listReturnDebits(area: 'EU' | 'CH', status?: string) {
  let q = T('bank_return_debits').select('*').eq('accounting_area', area).order('created_at', { ascending: false }).limit(500);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getAllocationsOfReturnDebit(rdId: string) {
  const { data, error } = await T('bank_return_debit_allocations').select('*').eq('return_debit_id', rdId).order('created_at');
  if (error) throw error;
  return (data ?? []) as any[];
}

/** Legt (falls nicht vorhanden) einen Rücklastschrift-Vorgang zu einer Bankbuchung an. */
export async function ensureReturnDebit(tx: any) {
  const existing = await getReturnDebitByTx(tx.id);
  if (existing) return existing;
  const det = detectReturnDebit(tx);
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await T('bank_return_debits').insert({
    tenant_id: tx.tenant_id ?? null,
    company_id: tx.company_id ?? null,
    accounting_area: tx.accounting_area ?? 'EU',
    bank_account_id: tx.bank_account_id ?? null,
    bank_transaction_id: tx.id,
    return_debit_amount: Math.abs(Number(tx.amount ?? 0)),
    currency: tx.currency ?? 'EUR',
    return_code: det.code,
    return_reason: det.reason,
    booking_date: tx.booking_date ?? null,
    value_date: tx.value_date ?? null,
    status: 'pruefung',
    created_by: u?.user?.id ?? null,
  } as any).select().single();
  if (error) throw error;
  await T('bank_transactions').update({ is_return_debit: true } as any).eq('id', tx.id);
  await logBank({
    action: 'ruecklastschrift_erkannt', bank_transaction_id: tx.id,
    new_value: { code: det.code, reason: det.reason, amount: Math.abs(Number(tx.amount ?? 0)) },
  });
  return data as any;
}

export async function updateReturnDebit(id: string, patch: Record<string, any>) {
  const { error } = await T('bank_return_debits').update(patch as any).eq('id', id);
  if (error) throw error;
}

/* ------------------------------------------- Manuelle Erfassung */

export interface ManualReturnDebitInput {
  area: 'EU' | 'CH';
  bankAccountId?: string | null;
  bookingDate: string;
  valueDate?: string | null;
  amount: number;
  currency: string;
  returnCode?: string | null;
  returnReason?: string | null;
  bankFee?: number;
  customerFee?: number;
  chargeCustomer?: boolean;
  customerId?: string | null;
  customerName?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  orderId?: string | null;
  iban?: string | null;
  mandateReference?: string | null;
  purpose?: string | null;
  note?: string | null;
}

/**
 * Erfasst eine Rücklastschrift manuell (ohne Bankimport).
 * Dazu wird eine synthetische Bankbuchung angelegt, damit alle
 * Folgeprozesse (Zuordnung, Bestätigung, Mahnung, Sperre) greifen.
 */
export async function createManualReturnDebit(input: ManualReturnDebitInput) {
  const { data: u } = await supabase.auth.getUser();
  const amount = Math.abs(Number(input.amount || 0));
  if (!amount) throw new Error('Bitte einen Betrag > 0 erfassen.');
  if (!input.bookingDate) throw new Error('Bitte ein Buchungsdatum erfassen.');

  const purpose = input.purpose
    ?? `Rücklastschrift${input.invoiceNumber ? ` Rechnung ${input.invoiceNumber}` : ''}${input.returnCode ? ` (${input.returnCode})` : ''}`;

  const { data: tx, error: txErr } = await T('bank_transactions').insert({
    accounting_area: input.area,
    bank_account_id: input.bankAccountId ?? null,
    booking_date: input.bookingDate,
    value_date: input.valueDate ?? input.bookingDate,
    amount: -amount,
    currency: input.currency || (input.area === 'CH' ? 'CHF' : 'EUR'),
    transaction_type: 'ausgang',
    sender_receiver_name: input.customerName ?? null,
    sender_receiver_iban: input.iban ?? null,
    booking_text: 'Rücklastschrift (manuell erfasst)',
    purpose,
    mandate_reference: input.mandateReference ?? null,
    invoice_number_hint: input.invoiceNumber ?? null,
    matched_customer_id: input.customerId ?? null,
    matched_invoice_id: input.invoiceId ?? null,
    status: 'offen',
    is_return_debit: true,
    note: input.note ?? null,
    raw_data: { source: 'manual_return_debit' } as any,
  } as any).select().single();
  if (txErr) throw txErr;

  const { data: rd, error } = await T('bank_return_debits').insert({
    accounting_area: input.area,
    bank_account_id: input.bankAccountId ?? null,
    bank_transaction_id: (tx as any).id,
    customer_id: input.customerId ?? null,
    invoice_id: input.invoiceId ?? null,
    invoice_number: input.invoiceNumber ?? null,
    order_id: input.orderId ?? null,
    return_debit_amount: amount,
    currency: input.currency || (input.area === 'CH' ? 'CHF' : 'EUR'),
    bank_fee: Number(input.bankFee ?? 0),
    customer_fee: Number(input.customerFee ?? 0),
    charge_customer: input.chargeCustomer ?? true,
    return_code: input.returnCode ?? null,
    return_reason: input.returnReason ?? (input.returnCode ? RETURN_CODES[input.returnCode] ?? null : null),
    booking_date: input.bookingDate,
    value_date: input.valueDate ?? input.bookingDate,
    status: 'pruefung',
    note: input.note ?? null,
    created_by: u?.user?.id ?? null,
  } as any).select().single();
  if (error) throw error;

  await logBank({
    action: 'ruecklastschrift_manuell_erfasst',
    bank_transaction_id: (tx as any).id,
    new_value: { amount, invoice_number: input.invoiceNumber, customer_id: input.customerId, code: input.returnCode },
  });

  return { rd: rd as any, tx: tx as any };
}

/* ------------------------------------------- Suche für manuelle Erfassung */

export async function searchInvoicesForReturn(area: 'EU' | 'CH', term: string) {
  const s = term.trim().replace(/[%,]/g, ' ');
  const cols = 'id,invoice_number,customer_id,customer_name,invoice_date,due_date,currency,total,balance,status,payment_status,reference_number';
  const build = (table: 'zoho_invoices' | 'zoho_recurring_invoices') => {
    // Bewusst KEINE Betrags-/Saldo-Einschränkung: Rücklastschriftbeträge enthalten
    // häufig Bankgebühren und weichen daher von der Rechnungssumme ab.
    let q = supabase.from(table).select(cols)
      .eq('accounting_region', area as any)
      .order('invoice_date', { ascending: false }).limit(50);
    if (s) q = q.or(`invoice_number.ilike.%${s}%,customer_name.ilike.%${s}%,reference_number.ilike.%${s}%`);
    return q;
  };
  const [std, rec] = await Promise.all([build('zoho_invoices'), build('zoho_recurring_invoices')]);
  return [
    ...(((std.data ?? []) as any[]).map(i => ({ ...i, __src: 'zoho' as const }))),
    ...(((rec.data ?? []) as any[]).map(i => ({ ...i, __src: 'recurring' as const }))),
  ];
}

export async function searchCustomersForReturn(term: string) {
  const s = term.trim().replace(/[%,]/g, ' ');
  let q = supabase.from('customers')
    .select('id,company_name,contact_name,email,external_customer_id,city,zip_code')
    .order('company_name', { ascending: true }).limit(25);
  if (s) q = q.or(`company_name.ilike.%${s}%,contact_name.ilike.%${s}%,email.ilike.%${s}%,external_customer_id.ilike.%${s}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as any[];
}


/* ------------------------------------------- Suche der ursprünglichen Zahlung */

const norm = (s?: string | null) => (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

/**
 * Toleranz für Betragsvergleiche bei Rücklastschriften.
 * In den Beträgen sind häufig Bankgebühren enthalten, daher darf der
 * Rücklastschriftbetrag vom Rechnungs-/Zahlbetrag abweichen.
 */
export function amountTolerance(amount: number): number {
  return Math.max(25, Math.abs(amount) * 0.1);
}

export interface PaymentCandidate {
  tx: any;
  allocations: any[];
  score: number;
  reasons: string[];
}

export interface PaymentSearchFilter {
  customerName?: string;
  invoiceNumber?: string;
  orderNumber?: string;
  iban?: string;
  amount?: number;
  bankReference?: string;
  endToEnd?: string;
  mandate?: string;
  dateFrom?: string;
  dateTo?: string;
  bankAccountId?: string;
}

/** Sucht mögliche Ursprungszahlungen zu einer Rücklastschrift und bewertet sie. */
export async function findOriginalPayments(
  tx: any, area: 'EU' | 'CH', filter: PaymentSearchFilter = {},
): Promise<PaymentCandidate[]> {
  const amount = Math.abs(Number(filter.amount ?? tx.amount ?? 0));
  let q = T('bank_transactions')
    .select('*')
    .eq('accounting_area', area)
    .eq('transaction_type', 'eingang')
    .neq('id', tx.id)
    .order('booking_date', { ascending: false })
    .limit(400);
  if (filter.bankAccountId) q = q.eq('bank_account_id', filter.bankAccountId);
  if (filter.dateFrom) q = q.gte('booking_date', filter.dateFrom);
  if (filter.dateTo) q = q.lte('booking_date', filter.dateTo);
  if (tx.booking_date && !filter.dateTo) q = q.lte('booking_date', tx.booking_date);
  if (amount > 0 && !filter.invoiceNumber && !filter.customerName) {
    // Toleranz für Bankgebühren: Rücklastschriftbetrag ≠ Zahlbetrag
    const tol = amountTolerance(amount);
    q = q.gte('amount', amount - tol).lte('amount', amount + tol);
  }
  const { data, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as any[];

  const f = {
    name: norm(filter.customerName),
    iban: norm(filter.iban),
    inv: norm(filter.invoiceNumber),
    ord: norm(filter.orderNumber),
    ref: norm(filter.bankReference),
    e2e: norm(filter.endToEnd),
    md: norm(filter.mandate),
  };
  if (f.name || f.iban || f.inv || f.ord || f.ref || f.e2e || f.md) {
    rows = rows.filter(r => {
      const hay = norm(`${r.sender_receiver_name} ${r.purpose} ${r.booking_text} ${r.bank_reference} ${r.end_to_end_reference} ${r.mandate_reference} ${r.customer_reference} ${r.invoice_number_hint}`);
      return [f.name, f.iban, f.inv, f.ord, f.ref, f.e2e, f.md].filter(Boolean).every(v => hay.includes(v) || norm(r.sender_receiver_iban).includes(v));
    });
  }

  const ids = rows.map(r => r.id);
  const allocMap = new Map<string, any[]>();
  if (ids.length) {
    for (let i = 0; i < ids.length; i += 200) {
      const { data: al } = await T('bank_transaction_allocations').select('*').in('bank_transaction_id', ids.slice(i, i + 200));
      (al ?? []).forEach((a: any) => {
        const list = allocMap.get(a.bank_transaction_id) ?? [];
        list.push(a); allocMap.set(a.bank_transaction_id, list);
      });
    }
  }

  const cands: PaymentCandidate[] = rows.map(r => {
    const reasons: string[] = [];
    let score = 0;
    const rAmount = Math.abs(Number(r.amount ?? 0));
    if (Math.abs(rAmount - amount) < 0.01) { score += 35; reasons.push('Betrag identisch'); }
    else if (amount > 0 && rAmount > amount && rAmount - amount < amount) { score += 12; reasons.push('Sammelzahlung mit höherem Betrag'); }
    if (tx.sender_receiver_iban && norm(r.sender_receiver_iban) === norm(tx.sender_receiver_iban)) { score += 20; reasons.push('IBAN identisch'); }
    if (tx.sender_receiver_name && norm(r.sender_receiver_name) && norm(r.sender_receiver_name) === norm(tx.sender_receiver_name)) { score += 15; reasons.push('Kundenname identisch'); }
    if (tx.end_to_end_reference && norm(r.end_to_end_reference) === norm(tx.end_to_end_reference)) { score += 15; reasons.push('End-to-End-Referenz identisch'); }
    if (tx.mandate_reference && norm(r.mandate_reference) === norm(tx.mandate_reference)) { score += 10; reasons.push('Mandatsreferenz identisch'); }
    if (tx.bank_reference && norm(r.bank_reference) === norm(tx.bank_reference)) { score += 5; reasons.push('Bankreferenz identisch'); }
    const allocs = allocMap.get(r.id) ?? [];
    if (allocs.length) { score += 10; reasons.push('Zahlung ist bereits einer Rechnung zugeordnet'); }
    if (tx.purpose && norm(r.purpose) && (norm(tx.purpose).includes(norm(r.purpose).slice(0, 12)) || norm(r.purpose).includes(norm(tx.purpose).slice(0, 12)))) {
      score += 5; reasons.push('Verwendungszweck ähnlich');
    }
    if (r.booking_date && tx.booking_date) {
      const days = Math.abs((new Date(tx.booking_date).getTime() - new Date(r.booking_date).getTime()) / 86400000);
      if (days <= 60) { score += 5; reasons.push('Zahlung liegt weniger als 60 Tage zurück'); }
    }
    return { tx: r, allocations: allocs, score: Math.min(100, score), reasons };
  });

  return cands.filter(c => c.score >= 20).sort((a, b) => b.score - a.score).slice(0, 25);
}

/* ------------------------------------------------------- Rechnungs-Update */

async function reopenInvoice(invoiceId: string, amount: number, returnDate: string | null) {
  let table: 'zoho_invoices' | 'zoho_recurring_invoices' = 'zoho_invoices';
  let { data: inv } = await supabase.from('zoho_invoices').select('id,total,balance,status,payment_status').eq('id', invoiceId).maybeSingle();
  if (!inv) {
    const r = await supabase.from('zoho_recurring_invoices').select('id,total,balance,status,payment_status').eq('id', invoiceId).maybeSingle();
    if (r.data) { inv = r.data as any; table = 'zoho_recurring_invoices'; }
  }
  if (!inv) return null;
  const total = Number(inv.total ?? 0);
  const newBalance = Math.min(total, Number(inv.balance ?? 0) + Math.abs(amount));
  const fully = newBalance >= total - 0.009;
  await supabase.from(table).update({
    balance: newBalance,
    payment_status: fully ? 'unpaid' : 'partially_paid',
    status: 'open',
    last_payment_date: null,
    notes_internal_return_date: undefined,
  } as any).eq('id', invoiceId);
  return { table, oldBalance: Number(inv.balance ?? 0), newBalance, status: fully ? 'offen' : 'teilbezahlt', total, returnDate };
}

/* --------------------------------------------------------- Bestätigung */

export interface ConfirmInput {
  rd: any;
  tx: any;
  originalPaymentTxId: string | null;
  customerId: string | null;
  allocations: Array<{
    invoice_id?: string | null;
    invoice_number?: string | null;
    order_id?: string | null;
    installment_id?: string | null;
    original_payment_allocation_id?: string | null;
    allocated_amount: number;
  }>;
  bankFee: number;
  additionalCosts: number;
  chargeCustomer: boolean;
  customerFee: number;
  feeHandling: 'intern' | 'weiterberechnen' | 'erlassen' | 'gebuehrenrechnung';
  costCenter?: string | null;
  bookingAccount?: string | null;
  note?: string | null;
  blockMandate: boolean;
  startReminder: boolean;
  createTask: boolean;
}

/**
 * Bestätigt eine Rücklastschrift.
 * Die ursprüngliche Zahlung bleibt unverändert erhalten – es werden ausschließlich
 * Gegenbuchungen erzeugt und die betroffenen Forderungen neu berechnet.
 */
export async function confirmReturnDebit(input: ConfirmInput) {
  const { rd, tx } = input;
  if (rd.status === 'bestaetigt' || rd.status === 'erledigt') throw new Error('Diese Rücklastschrift wurde bereits bestätigt.');
  const sum = input.allocations.reduce((s, a) => s + Number(a.allocated_amount || 0), 0);
  const total = Math.abs(Number(rd.return_debit_amount ?? tx.amount ?? 0));
  if (!input.allocations.length) throw new Error('Bitte mindestens eine Rechnung oder Rate zuordnen.');
  if (Math.abs(sum - total) > 0.01) {
    throw new Error(`Die Aufteilung (${sum.toFixed(2)}) muss exakt dem Rücklastschriftbetrag (${total.toFixed(2)}) entsprechen.`);
  }

  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id ?? null;
  const invoiceInfos: any[] = [];

  for (const a of input.allocations) {
    const { error } = await T('bank_return_debit_allocations').insert({
      return_debit_id: rd.id,
      invoice_id: a.invoice_id ?? null,
      invoice_number: a.invoice_number ?? null,
      installment_id: a.installment_id ?? null,
      order_id: a.order_id ?? null,
      original_payment_allocation_id: a.original_payment_allocation_id ?? null,
      allocated_amount: Number(a.allocated_amount),
      created_by: uid,
    } as any);
    if (error) throw error;

    // Gegenbuchung auf der ursprünglichen Zahlung (Originalzuordnung bleibt bestehen)
    if (input.originalPaymentTxId) {
      await T('bank_transaction_allocations').insert({
        bank_transaction_id: input.originalPaymentTxId,
        invoice_id: a.invoice_id ?? null,
        invoice_number: a.invoice_number ?? null,
        customer_id: input.customerId ?? null,
        order_id: a.order_id ?? null,
        allocation_type: 'ruecklastschrift',
        allocated_amount: -Math.abs(Number(a.allocated_amount)),
        currency: rd.currency ?? 'EUR',
        reversal_of: a.original_payment_allocation_id ?? null,
        note: `Rücklastschrift ${rd.return_code ?? ''} ${rd.return_reason ?? ''}`.trim(),
        created_by: uid,
      } as any);
    }

    if (a.invoice_id) {
      const info = await reopenInvoice(a.invoice_id, Number(a.allocated_amount), rd.booking_date ?? null);
      if (info) invoiceInfos.push({ invoice_id: a.invoice_id, invoice_number: a.invoice_number, ...info });
    }
  }

  // Gebühren getrennt erfassen
  const fee = Number(input.bankFee || 0) + Number(input.additionalCosts || 0);
  if (fee > 0) {
    await T('bank_transaction_allocations').insert({
      bank_transaction_id: tx.id,
      customer_id: input.customerId ?? null,
      allocation_type: 'bankgebuehr',
      allocated_amount: fee,
      currency: rd.currency ?? 'EUR',
      note: input.chargeCustomer ? 'Rücklastschriftgebühr – wird dem Kunden berechnet' : 'Rücklastschriftgebühr – intern',
      created_by: uid,
    } as any);
  }

  const fullyReturned = invoiceInfos.every(i => i.status === 'offen');
  const newStatus = 'bestaetigt';
  await updateReturnDebit(rd.id, {
    original_payment_transaction_id: input.originalPaymentTxId,
    customer_id: input.customerId,
    invoice_id: input.allocations[0]?.invoice_id ?? null,
    invoice_number: input.allocations[0]?.invoice_number ?? null,
    order_id: input.allocations[0]?.order_id ?? null,
    installment_id: input.allocations[0]?.installment_id ?? null,
    bank_fee: input.bankFee,
    additional_costs: input.additionalCosts,
    customer_fee: input.chargeCustomer ? input.customerFee : 0,
    charge_customer: input.chargeCustomer,
    fee_handling: input.feeHandling,
    cost_center: input.costCenter ?? null,
    booking_account: input.bookingAccount ?? null,
    note: input.note ?? null,
    status: newStatus,
    sepa_mandate_blocked: input.blockMandate,
    reminder_process_started: input.startReminder,
    confirmed_by: uid,
    confirmed_at: new Date().toISOString(),
  });

  await T('bank_transactions').update({
    status: 'verbucht',
    matched_customer_id: input.customerId ?? null,
    note: `Rücklastschrift bestätigt${fullyReturned ? ' (vollständig)' : ' (teilweise)'}`,
  } as any).eq('id', tx.id);

  // Zahlungsrisiko / Lastschriftsperre
  if (input.customerId) {
    const history = await getCustomerReturnDebits(input.customerId);
    const count = history.length;
    if (input.blockMandate) {
      await setRiskFlag(input.customerId, {
        risk_type: count >= 3 ? 'lastschrift_dauerhaft_gesperrt' : 'lastschrift_gesperrt',
        risk_level: count >= 3 ? 'hoch' : count >= 2 ? 'mittel' : 'niedrig',
        reason: `Rücklastschrift ${rd.return_reason ?? ''} (${count}. Vorfall)`.trim(),
        related_return_debit_id: rd.id,
        tenant_id: rd.tenant_id, company_id: rd.company_id,
      });
    }
    if (count >= 3) {
      await setRiskFlag(input.customerId, {
        risk_type: 'zahlungsrisiko_erhoeht',
        risk_level: 'hoch',
        reason: 'Dritte Rücklastschrift – Vorkasse empfohlen, neue Aufträge nur nach Freigabe',
        related_return_debit_id: rd.id,
        tenant_id: rd.tenant_id, company_id: rd.company_id,
      });
    }
  }

  // Gerätesperre aus der Rückbuchung erzeugen (Übersicht "Gerätesperren")
  try { await createDeviceLockFromReturnDebit(rd, input.customerId ?? null, invoiceInfos, total, fee); }
  catch (e) { console.error('Gerätesperre konnte nicht angelegt werden', e); }

  if (input.createTask) await notifyAccounting(rd, invoiceInfos, input.customerId);

  await logBank({
    action: 'ruecklastschrift_bestaetigt',
    bank_transaction_id: tx.id,
    old_value: { original_payment_transaction_id: input.originalPaymentTxId, invoices: invoiceInfos.map(i => ({ id: i.invoice_id, balance_vorher: i.oldBalance })) },
    new_value: {
      return_debit_id: rd.id, amount: total, fee, charge_customer: input.chargeCustomer,
      invoices: invoiceInfos.map(i => ({ id: i.invoice_id, balance_neu: i.newBalance, status: i.status })),
      sepa_mandate_blocked: input.blockMandate, reminder: input.startReminder,
    },
  });

  return { invoiceInfos, fullyReturned };
}

/** Storniert eine bestätigte Rücklastschrift-Zuordnung (nur Super Admin). */
export async function cancelReturnDebit(rd: any, reason: string) {
  if (rd.status === 'storniert') throw new Error('Diese Rücklastschrift ist bereits storniert.');
  const allocs = await getAllocationsOfReturnDebit(rd.id);
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id ?? null;

  for (const a of allocs) {
    if (a.invoice_id) {
      // Stornobuchung: der zuvor wieder geöffnete Betrag wird erneut ausgeglichen
      let table: 'zoho_invoices' | 'zoho_recurring_invoices' = 'zoho_invoices';
      let { data: inv } = await supabase.from('zoho_invoices').select('id,total,balance').eq('id', a.invoice_id).maybeSingle();
      if (!inv) {
        const r = await supabase.from('zoho_recurring_invoices').select('id,total,balance').eq('id', a.invoice_id).maybeSingle();
        if (r.data) { inv = r.data as any; table = 'zoho_recurring_invoices'; }
      }
      if (inv) {
        const newBalance = Math.max(0, Number(inv.balance ?? 0) - Math.abs(Number(a.allocated_amount)));
        await supabase.from(table).update({
          balance: newBalance,
          payment_status: newBalance <= 0.009 ? 'paid' : 'partially_paid',
          status: newBalance <= 0.009 ? 'paid' : 'open',
        } as any).eq('id', a.invoice_id);
      }
    }
    if (rd.original_payment_transaction_id) {
      await T('bank_transaction_allocations').insert({
        bank_transaction_id: rd.original_payment_transaction_id,
        invoice_id: a.invoice_id, invoice_number: a.invoice_number,
        customer_id: rd.customer_id, order_id: a.order_id,
        allocation_type: 'gegenbuchung',
        allocated_amount: Math.abs(Number(a.allocated_amount)),
        currency: rd.currency ?? 'EUR',
        note: `Storno Rücklastschrift: ${reason}`,
        created_by: uid,
      } as any);
    }
  }

  await updateReturnDebit(rd.id, { status: 'storniert', note: reason });
  await T('bank_transactions').update({ status: 'offen', note: `Rücklastschrift-Zuordnung storniert: ${reason}` } as any)
    .eq('id', rd.bank_transaction_id);
  if (rd.customer_id) {
    await T('payment_risk_flags').update({ active: false, resolved_by: uid, resolved_at: new Date().toISOString() } as any)
      .eq('related_return_debit_id', rd.id);
  }
  await logBank({
    action: 'ruecklastschrift_storniert', bank_transaction_id: rd.bank_transaction_id,
    old_value: { status: rd.status }, new_value: { status: 'storniert', reason },
  });
}

/* -------------------------------------------------------- Risiko-Kennzeichen */

export async function setRiskFlag(customerId: string, flag: {
  risk_type: string; risk_level: string; reason?: string | null;
  related_return_debit_id?: string | null; tenant_id?: string | null; company_id?: string | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  const { data: existing } = await T('payment_risk_flags')
    .select('id').eq('customer_id', customerId).eq('risk_type', flag.risk_type).eq('active', true).maybeSingle();
  if (existing) {
    await T('payment_risk_flags').update({ risk_level: flag.risk_level, reason: flag.reason ?? null } as any).eq('id', (existing as any).id);
    return;
  }
  await T('payment_risk_flags').insert({
    customer_id: customerId,
    risk_type: flag.risk_type,
    risk_level: flag.risk_level,
    reason: flag.reason ?? null,
    related_return_debit_id: flag.related_return_debit_id ?? null,
    tenant_id: flag.tenant_id ?? null,
    company_id: flag.company_id ?? null,
    created_by: u?.user?.id ?? null,
  } as any);
}

export async function listRiskFlags(customerId: string, onlyActive = true) {
  let q = T('payment_risk_flags').select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
  if (onlyActive) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as any[];
}

/** Hebt eine Lastschriftsperre auf – nur Admin/Super Admin (serverseitig über RLS geprüft). */
export async function resolveRiskFlag(id: string) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await T('payment_risk_flags').update({
    active: false, resolved_by: u?.user?.id ?? null, resolved_at: new Date().toISOString(),
  } as any).eq('id', id);
  if (error) throw error;
}

export const RISK_LABELS: Record<string, string> = {
  lastschrift_aktiv: 'Lastschrift aktiv',
  lastschrift_gesperrt: 'Lastschrift vorübergehend gesperrt',
  lastschrift_dauerhaft_gesperrt: 'Lastschrift dauerhaft gesperrt',
  neues_mandat_erforderlich: 'Neues SEPA-Mandat erforderlich',
  manuelle_freigabe: 'Manuelle Freigabe erforderlich',
  zahlungsrisiko_erhoeht: 'Erhöhtes Zahlungsrisiko',
};

/* ------------------------------------------------------------ Kundenhistorie */

export async function getCustomerReturnDebits(customerId: string) {
  const { data, error } = await T('bank_return_debits')
    .select('*').eq('customer_id', customerId).neq('status', 'storniert')
    .order('booking_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export interface CustomerReturnSummary {
  count: number;
  total: number;
  openTotal: number;
  fees: number;
  lastDate: string | null;
  reasons: string[];
  rows: any[];
  flags: any[];
}

export async function getCustomerReturnSummary(customerId: string): Promise<CustomerReturnSummary> {
  const [rows, flags] = await Promise.all([getCustomerReturnDebits(customerId), listRiskFlags(customerId)]);
  return {
    count: rows.length,
    total: rows.reduce((s, r) => s + Number(r.return_debit_amount || 0), 0),
    openTotal: rows.filter(r => !['erledigt', 'storniert'].includes(r.status)).reduce((s, r) => s + Number(r.return_debit_amount || 0), 0),
    fees: rows.reduce((s, r) => s + Number(r.bank_fee || 0) + Number(r.additional_costs || 0), 0),
    lastDate: rows[0]?.booking_date ?? null,
    reasons: [...new Set(rows.map(r => r.return_reason).filter(Boolean))] as string[],
    rows, flags,
  };
}

/* ---------------------------------------------------------------- Aufgabe */

async function notifyAccounting(rd: any, invoiceInfos: any[], customerId: string | null) {
  try {
    const { data: admins } = await supabase.from('user_roles' as any).select('user_id').in('role', ['Admin', 'Super Admin'] as any);
    const ids = [...new Set(((admins ?? []) as any[]).map(a => a.user_id))];
    if (!ids.length) return;
    await supabase.from('app_notifications').insert(ids.map(id => ({
      user_id: id,
      category: 'finance',
      title: 'Rücklastschrift bestätigt – Forderung wieder offen',
      message: `${Number(rd.return_debit_amount).toFixed(2)} ${rd.currency} · ${rd.return_reason ?? 'Rücklastschrift'}${invoiceInfos[0]?.invoice_number ? ` · Rechnung ${invoiceInfos[0].invoice_number}` : ''}`,
      priority: 'high',
      action_url: '/finance/kontoauszuege/ruecklastschriften',
      metadata: { return_debit_id: rd.id, customer_id: customerId } as any,
    })) as any);
  } catch { /* Benachrichtigung ist optional */ }
}

/* ------------------------------------------------------------- Regelwerk */

export interface ReturnRules {
  firstWarn: boolean;
  secondBlock: boolean;
  secondNotifyAdmin: boolean;
  secondBlockDelivery: boolean;
  thirdRisk: boolean;
  thirdNotifySuperadmin: boolean;
  thirdNoAutoDebit: boolean;
  thirdApprovalRequired: boolean;
  defaultBankFee: number;
  defaultCustomerFee: number;
  chargeCustomerByDefault: boolean;
}

export const DEFAULT_RETURN_RULES: ReturnRules = {
  firstWarn: true, secondBlock: true, secondNotifyAdmin: true, secondBlockDelivery: false,
  thirdRisk: true, thirdNotifySuperadmin: true, thirdNoAutoDebit: true, thirdApprovalRequired: true,
  defaultBankFee: 8, defaultCustomerFee: 8, chargeCustomerByDefault: true,
};

const RULES_KEY = 'bank_return_debit_rules';

export async function loadReturnRules(): Promise<ReturnRules> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', RULES_KEY).maybeSingle();
  return { ...DEFAULT_RETURN_RULES, ...((data?.value as any) ?? {}) };
}

export async function saveReturnRules(rules: ReturnRules) {
  const { error } = await (supabase.from('app_settings') as any).upsert(
    { key: RULES_KEY, value: rules as any }, { onConflict: 'key' },
  );
  if (error) throw error;
}

/* ------------------------------------------- Mahnung / Sperrankündigung */

export interface ReturnDunningPreview {
  recipient: string | null;
  customerName: string;
  amount: number;
  fee: number;
  total: number;
  currency: string;
  payUntil: string;
  blockDate: string;
  items: { invoice_number: string | null; amount: number; due_date: string | null }[];
}

const deDate = (d: Date) => d.toLocaleDateString('de-DE');

/** Sammelt alle Daten für die Rücklastschrift-Mahnung (Vorschau + Versand). */
export async function buildReturnDunning(rd: any, payDays = 7): Promise<ReturnDunningPreview> {
  const allocs = await getAllocationsOfReturnDebit(rd.id);
  let customerName = '';
  let recipient: string | null = null;
  if (rd.customer_id) {
    const { data: c } = await supabase.from('customers')
      .select('company_name, contact_name, email').eq('id', rd.customer_id).maybeSingle();
    customerName = (c as any)?.company_name || (c as any)?.contact_name || '';
    recipient = (c as any)?.email ?? null;
  }
  const amount = Number(rd.return_debit_amount || 0);
  const fee = Number(rd.customer_fee || 0);
  const due = new Date(); due.setDate(due.getDate() + payDays);
  const block = new Date(due); block.setDate(block.getDate() + 1);
  return {
    recipient, customerName, amount, fee, total: amount + fee,
    currency: rd.currency || 'EUR',
    payUntil: deDate(due), blockDate: deDate(block),
    items: allocs.map(a => ({
      invoice_number: a.invoice_number ?? null,
      amount: Number(a.allocated_amount || 0),
      due_date: null,
    })),
  };
}

/** Versendet die Mahnung inkl. Ankündigung der Leistungssperre an den Kunden. */
export async function sendReturnDebitDunning(rd: any, payDays = 7) {
  const info = await buildReturnDunning(rd, payDays);
  if (!info.recipient) throw new Error('Kunde hat keine E-Mail-Adresse hinterlegt');

  let bank: any = null;
  if (rd.bank_account_id) {
    const { data } = await supabase.from('bank_accounts' as any)
      .select('iban, bic, bank_name').eq('id', rd.bank_account_id).maybeSingle();
    bank = data;
  }

  const { buildReturnDunningVars } = await import('./returnDunningLetter');
  const { loadReturnDunningEmail, fillReturnDunningEmail } = await import('./returnDunningEmail');
  const emailCfg = await loadReturnDunningEmail();
  const texts = fillReturnDunningEmail(emailCfg, await buildReturnDunningVars(rd, payDays));

  const { error } = await supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'ruecklastschrift-mahnung',
      recipientEmail: info.recipient,
      idempotencyKey: `ruecklastschrift-mahnung-${rd.id}-${new Date().toISOString().slice(0, 10)}`,
      templateData: {
        customerName: info.customerName,
        returnDate: rd.booking_date ? new Date(rd.booking_date).toLocaleDateString('de-DE') : null,
        returnReason: rd.return_reason ?? null,
        returnCode: rd.return_code ?? null,
        amount: info.amount,
        fee: info.fee,
        total: info.total,
        currency: info.currency,
        payUntil: info.payUntil,
        blockDate: info.blockDate,
        mandateBlocked: !!rd.sepa_mandate_blocked,
        items: info.items,
        iban: bank?.iban ?? null,
        bic: bank?.bic ?? null,
        bankName: bank?.bank_name ?? null,
        reference: info.items[0]?.invoice_number ?? null,
        ...texts,
      },
    },
  });
  if (error) throw new Error(error.message);

  await updateReturnDebit(rd.id, {
    status: 'mahnprozess',
    reminder_process_started: true,
    note: [rd.note, `Mahnung mit Sperrankündigung an ${info.recipient} versendet (zahlbar bis ${info.payUntil}, Sperre ab ${info.blockDate}).`]
      .filter(Boolean).join('\n'),
  });

  await logBank({
    action: 'ruecklastschrift_mahnung_versendet',
    bank_transaction_id: rd.bank_transaction_id ?? null,
    new_value: { recipient: info.recipient, total: info.total, payUntil: info.payUntil, blockDate: info.blockDate },
  });

  return info;
}

/* ------------------------------------------- Gerätesperren-Kopplung */

/**
 * Kopiert eine gebuchte Rücklastschrift als Datensatz in die Übersicht
 * "Gerätesperren" (Tabelle device_locks, Quelle "ruecklastschrift").
 * Idempotent: pro Rücklastschrift wird höchstens ein Eintrag angelegt.
 */
export async function createDeviceLockFromReturnDebit(
  rd: any,
  customerId: string | null,
  invoiceInfos: { invoice_id?: string | null; invoice_number?: string | null }[] = [],
  amount?: number,
  fee?: number,
) {
  const marker = `[RD:${rd.id}]`;

  const { data: existing } = await supabase.from('device_locks' as any)
    .select('id').ilike('lock_note', `%${marker}%`).limit(1);
  if (existing?.length) return (existing[0] as any).id as string;

  let customerName: string | null = null;
  let customerNumber: string | null = null;
  if (customerId) {
    const { data: c } = await supabase.from('customers')
      .select('company_name, contact_name, external_customer_id').eq('id', customerId).maybeSingle();
    customerName = (c as any)?.company_name || (c as any)?.contact_name || null;
    customerNumber = (c as any)?.external_customer_id ?? null;
  }

  const invNumbers = invoiceInfos.map(i => i.invoice_number).filter(Boolean) as string[];
  const invoiceNumber = rd.invoice_number ?? invNumbers[0] ?? null;
  const total = Number(amount ?? rd.return_debit_amount ?? 0);
  const feeVal = Number(fee ?? ((rd.bank_fee ?? 0) + (rd.additional_costs ?? 0)));
  const returnDate = rd.booking_date ?? rd.value_date ?? new Date().toISOString().slice(0, 10);

  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id ?? null;

  const note = [
    `Rücklastschrift vom ${new Date(returnDate).toLocaleDateString('de-DE')}`,
    invNumbers.length ? `Rechnung(en) ${invNumbers.join(', ')}` : (invoiceNumber ? `Rechnung ${invoiceNumber}` : null),
    `Betrag ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: rd.currency || 'EUR' }).format(total)}`,
    feeVal > 0 ? `Gebühren ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: rd.currency || 'EUR' }).format(feeVal)}` : null,
    rd.return_code ? `Code ${rd.return_code}` : null,
    rd.return_reason ?? null,
    rd.sepa_mandate_blocked ? 'SEPA-Mandat gesperrt' : null,
    marker,
  ].filter(Boolean).join(' | ');

  const { data: ins, error } = await supabase.from('device_locks' as any).insert({
    invoice_id: rd.invoice_id ?? invoiceInfos[0]?.invoice_id ?? null,
    invoice_number: invoiceNumber,
    customer_id: customerId,
    customer_number: customerNumber,
    customer_name: customerName,
    amount: total,
    currency: rd.currency || 'EUR',
    return_date: returnDate,
    return_reason: rd.return_reason ?? rd.return_code ?? 'Rücklastschrift',
    lock_note: note,
    status: 'aktiv',
    source: 'ruecklastschrift',
    activated_at: new Date().toISOString(),
    activated_by: uid,
    created_by: uid,
  } as any).select('id').maybeSingle();
  if (error) throw error;

  await logBank({
    action: 'geraetesperre_aus_ruecklastschrift',
    bank_transaction_id: rd.bank_transaction_id ?? null,
    new_value: { return_debit_id: rd.id, device_lock_id: (ins as any)?.id ?? null, invoice_number: invoiceNumber, amount: total },
  });

  return (ins as any)?.id as string | undefined;
}
