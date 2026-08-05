import { supabase } from '@/integrations/supabase/client';

const T = (n: string) => supabase.from(n as any);

export type AccountingArea = 'EU' | 'CH';

export interface BankAccount {
  id: string; bank_name: string; account_name: string; iban: string | null; bic: string | null;
  currency: string; country: string | null; accounting_area: string; company_id: string | null;
  tenant_id: string | null; automatic_booking_enabled: boolean; auto_book_threshold: number;
  active: boolean; notes: string | null;
}

/* ------------------------------------------------------------- Audit-Log */

export async function logBank(entry: {
  action: string;
  bank_transaction_id?: string | null;
  bank_import_id?: string | null;
  old_value?: any;
  new_value?: any;
  company_id?: string | null;
  tenant_id?: string | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  await T('bank_audit_log').insert({
    action: entry.action,
    bank_transaction_id: entry.bank_transaction_id ?? null,
    bank_import_id: entry.bank_import_id ?? null,
    old_value: entry.old_value ?? null,
    new_value: entry.new_value ?? null,
    company_id: entry.company_id ?? null,
    tenant_id: entry.tenant_id ?? null,
    user_id: u?.user?.id ?? null,
    user_email: u?.user?.email ?? null,
  } as any);
}

/* ------------------------------------------------------------- Bankkonten */

export async function listBankAccounts(area?: AccountingArea) {
  let q = T('bank_accounts').select('*').order('bank_name');
  if (area) q = q.eq('accounting_area', area);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as BankAccount[];
}

const normIban = (v?: string | null) => (v ?? '').replace(/\s+/g, '').toUpperCase();

/** Prüft, ob die IBAN im gleichen Buchhaltungsbereich bereits existiert. */
async function ibanExists(iban: string, area: string, excludeId?: string) {
  const { data, error } = await T('bank_accounts').select('id, iban, accounting_area');
  if (error) throw error;
  return ((data ?? []) as any[]).some(r =>
    r.id !== excludeId && r.accounting_area === area && normIban(r.iban) === iban,
  );
}

export async function saveBankAccount(payload: Partial<BankAccount> & { id?: string }) {
  const iban = normIban(payload.iban);
  const area = payload.accounting_area ?? 'EU';
  if (iban && await ibanExists(iban, area, payload.id)) {
    throw new Error(`Ein Bankkonto mit dieser IBAN existiert bereits in der Buchhaltung ${area}.`);
  }
  if (payload.id) {
    const { error } = await T('bank_accounts').update(payload as any).eq('id', payload.id);
    if (error) throw error;
    await logBank({ action: 'bankkonto_geaendert', new_value: payload });
  } else {
    const { error } = await T('bank_accounts').insert(payload as any);
    if (error) throw error;
    await logBank({ action: 'bankkonto_angelegt', new_value: payload });
  }
}

/* ---------------------------------------------------------------- Importe */

export async function listImports(area: AccountingArea, limit = 100) {
  const { data, error } = await T('bank_imports')
    .select('*, bank_accounts:bank_account_id(bank_name,account_name,iban)')
    .eq('accounting_area', area)
    .order('imported_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as any[];
}

/* ----------------------------------------------------------- Transaktionen */

export interface TxQuery {
  area: AccountingArea;
  status?: string[];
  bankAccountId?: string;
  importId?: string;
  search?: string;
  direction?: 'eingang' | 'ausgang';
  from?: string; to?: string;
  amountMin?: number; amountMax?: number;
  page?: number; pageSize?: number;
}

export async function listTransactions(q: TxQuery) {
  const page = q.page ?? 0;
  const size = q.pageSize ?? 50;
  let sel = T('bank_transactions')
    .select('*, bank_accounts:bank_account_id(bank_name,account_name,iban,currency)', { count: 'exact' })
    .eq('accounting_area', q.area);
  if (q.status?.length) sel = sel.in('status', q.status);
  if (q.bankAccountId) sel = sel.eq('bank_account_id', q.bankAccountId);
  if (q.importId) sel = sel.eq('bank_import_id', q.importId);
  if (q.direction) sel = sel.eq('transaction_type', q.direction);
  if (q.from) sel = sel.gte('booking_date', q.from);
  if (q.to) sel = sel.lte('booking_date', q.to);
  if (typeof q.amountMin === 'number') sel = sel.gte('amount', q.amountMin);
  if (typeof q.amountMax === 'number') sel = sel.lte('amount', q.amountMax);
  if (q.search?.trim()) {
    const s = q.search.trim().replace(/[%,]/g, ' ');
    sel = sel.or(
      `purpose.ilike.%${s}%,booking_text.ilike.%${s}%,sender_receiver_name.ilike.%${s}%,sender_receiver_iban.ilike.%${s}%,bank_reference.ilike.%${s}%,end_to_end_reference.ilike.%${s}%`
    );
  }
  const { data, error, count } = await sel
    .order('booking_date', { ascending: false })
    .range(page * size, page * size + size - 1);
  if (error) throw error;
  return { rows: (data ?? []) as any[], count: count ?? 0 };
}

export async function getMatches(txId: string) {
  const { data, error } = await T('bank_transaction_matches')
    .select('*').eq('bank_transaction_id', txId).order('matching_score', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getAllocations(txId: string) {
  const { data, error } = await T('bank_transaction_allocations')
    .select('*').eq('bank_transaction_id', txId).order('created_at');
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getTxAudit(txId: string) {
  const { data, error } = await T('bank_audit_log')
    .select('*').eq('bank_transaction_id', txId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function setTxStatus(txId: string, status: string, note?: string) {
  const { data: before } = await T('bank_transactions').select('status').eq('id', txId).maybeSingle();
  const { error } = await T('bank_transactions').update({ status, ...(note ? { note } : {}) } as any).eq('id', txId);
  if (error) throw error;
  await logBank({
    action: status === 'ignoriert' ? 'buchung_ignoriert' : status === 'zurueckgestellt' ? 'buchung_zurueckgestellt' : 'status_geaendert',
    bank_transaction_id: txId, old_value: before, new_value: { status, note },
  });
}

/* ------------------------------------------------------------- Verbuchung */

export interface AllocationInput {
  invoice_id?: string | null;
  invoice_number?: string | null;
  customer_id?: string | null;
  supplier_id?: string | null;
  order_id?: string | null;
  allocation_type: string; // rechnung | anzahlung | guthaben | sonstige_einnahme | sonstige_ausgabe | bankgebuehr | ruecklastschrift | erstattung | lieferant
  allocated_amount: number;
}

/** Verbucht eine Bankbuchung mit einer oder mehreren Zuordnungen. */
export async function bookTransaction(tx: any, allocations: AllocationInput[]) {
  const total = allocations.reduce((s, a) => s + Number(a.allocated_amount || 0), 0);
  const abs = Math.abs(Number(tx.amount));
  if (Math.abs(total - abs) > 0.01) {
    throw new Error(`Summe der Zuordnungen (${total.toFixed(2)}) weicht vom Buchungsbetrag (${abs.toFixed(2)}) ab.`);
  }
  if (tx.status === 'verbucht') throw new Error('Diese Buchung ist bereits verbucht.');
  if (tx.is_duplicate) throw new Error('Mögliche Dublette – bitte zuerst prüfen und bestätigen.');

  const { data: u } = await supabase.auth.getUser();

  for (const a of allocations) {
    const { error } = await T('bank_transaction_allocations').insert({
      bank_transaction_id: tx.id,
      invoice_id: a.invoice_id ?? null,
      invoice_number: a.invoice_number ?? null,
      customer_id: a.customer_id ?? null,
      supplier_id: a.supplier_id ?? null,
      order_id: a.order_id ?? null,
      allocation_type: a.allocation_type,
      allocated_amount: a.allocated_amount,
      currency: tx.currency,
      created_by: u?.user?.id ?? null,
    } as any);
    if (error) throw error;

    if (a.invoice_id && a.allocation_type === 'rechnung') {
      let table: 'zoho_invoices' | 'zoho_recurring_invoices' = 'zoho_invoices';
      let { data: inv } = await supabase.from('zoho_invoices')
        .select('id,balance,total,status,payment_status').eq('id', a.invoice_id).maybeSingle();
      if (!inv) {
        const r = await supabase.from('zoho_recurring_invoices')
          .select('id,balance,total,status,payment_status').eq('id', a.invoice_id).maybeSingle();
        if (r.data) { inv = r.data as any; table = 'zoho_recurring_invoices'; }
      }
      if (inv) {
        const newBalance = Math.max(0, Number(inv.balance ?? 0) - Number(a.allocated_amount));
        const paid = newBalance <= 0.009;
        const { error: uErr } = await supabase.from(table).update({
          balance: newBalance,
          payment_status: paid ? 'paid' : 'partially_paid',
          status: paid ? 'paid' : (inv.status ?? 'open'),
          last_payment_date: tx.booking_date ?? new Date().toISOString().slice(0, 10),
        } as any).eq('id', a.invoice_id);
        if (uErr) throw uErr;
        await logBank({
          action: 'zahlung_verbucht', bank_transaction_id: tx.id,
          old_value: { invoice_id: inv.id, balance: inv.balance, status: inv.status, table },
          new_value: { invoice_id: inv.id, balance: newBalance, status: paid ? 'paid' : 'partially_paid', amount: a.allocated_amount, table },
        });
      }
    }

  }

  const primary = allocations.find(a => a.invoice_id) ?? allocations[0];
  const { error: tErr } = await T('bank_transactions').update({
    status: 'verbucht',
    matched_invoice_id: primary?.invoice_id ?? null,
    matched_customer_id: primary?.customer_id ?? null,
  } as any).eq('id', tx.id);
  if (tErr) throw tErr;

  const learnAlloc = allocations.find(a => a.customer_id) ?? null;
  if (learnAlloc) {
    const { learnFromBooking } = await import('./rules');
    await learnFromBooking(tx, learnAlloc);
  }

  await logBank({
    action: 'buchung_verbucht', bank_transaction_id: tx.id,
    old_value: { status: tx.status }, new_value: { status: 'verbucht', allocations },
  });
}

/** Storniert eine Verbuchung durch Gegenbuchung (keine physische Löschung). */
export async function reverseTransaction(tx: any, reason: string) {
  const allocs = await getAllocations(tx.id);
  const { data: u } = await supabase.auth.getUser();
  for (const a of allocs) {
    if (a.reversal_of) continue;
    await T('bank_transaction_allocations').insert({
      bank_transaction_id: tx.id,
      invoice_id: a.invoice_id, invoice_number: a.invoice_number, customer_id: a.customer_id,
      supplier_id: a.supplier_id, order_id: a.order_id,
      allocation_type: 'gegenbuchung',
      allocated_amount: -Number(a.allocated_amount),
      currency: a.currency, reversal_of: a.id, note: reason,
      created_by: u?.user?.id ?? null,
    } as any);
    if (a.invoice_id && a.allocation_type === 'rechnung') {
      let table: 'zoho_invoices' | 'zoho_recurring_invoices' = 'zoho_invoices';
      let { data: inv } = await supabase.from('zoho_invoices').select('id,balance,total').eq('id', a.invoice_id).maybeSingle();
      if (!inv) {
        const r = await supabase.from('zoho_recurring_invoices').select('id,balance,total').eq('id', a.invoice_id).maybeSingle();
        if (r.data) { inv = r.data as any; table = 'zoho_recurring_invoices'; }
      }
      if (inv) {
        const newBalance = Number(inv.balance ?? 0) + Number(a.allocated_amount);
        await supabase.from(table).update({
          balance: newBalance,
          payment_status: newBalance >= Number(inv.total ?? 0) - 0.009 ? 'unpaid' : 'partially_paid',
          status: 'open',
        } as any).eq('id', a.invoice_id);
      }
    }

  }
  await T('bank_transactions').update({ status: 'offen', note: reason } as any).eq('id', tx.id);
  await logBank({ action: 'zahlung_storniert', bank_transaction_id: tx.id, old_value: { status: 'verbucht' }, new_value: { status: 'offen', reason } });
}
