// Phase 2: Bridge Zoho invoices -> finance_transactions / finance_accounts
// Idempotent via unique reference. Aggregates balances per customer.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Row = { customer_id: string | null; external_customer_id: string | null };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const started = Date.now();
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Load customer mapping (external_customer_id -> id)
    const custMap = new Map<string, string>();
    {
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await admin
          .from('customers')
          .select('id, external_customer_id')
          .not('external_customer_id', 'is', null)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        for (const r of (data ?? []) as Row[]) {
          if (r.external_customer_id && r.customer_id == null) custMap.set(r.external_customer_id, (r as any).id);
        }
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
    }

    // 2) Fetch zoho_invoices since last sync (last 5000)
    const { data: invoices, error: invErr } = await admin
      .from('zoho_invoices')
      .select('zoho_invoice_id, invoice_number, customer_id, customer_name, invoice_date, due_date, total, balance, currency, payment_status, last_payment_date, source_system')
      .order('invoice_date', { ascending: false })
      .limit(5000);
    if (invErr) throw invErr;

    let txInserted = 0, txUpdated = 0, txSkipped = 0;
    const touchedCustomers = new Set<string>();
    const lastPaymentByCustomer = new Map<string, string>();

    for (const inv of invoices ?? []) {
      const localCustomerId = inv.customer_id ? custMap.get(String(inv.customer_id)) : null;
      if (!localCustomerId) { txSkipped++; continue; }
      const reference = `zoho:invoice:${inv.source_system ?? 'eu1'}:${inv.zoho_invoice_id}`;
      const payload = {
        customer_id: localCustomerId,
        amount: Number(inv.total ?? 0),
        currency: inv.currency ?? 'EUR',
        booking_date: inv.invoice_date,
        reference,
        transaction_type: 'Rechnung',
        notes: `Zoho ${inv.invoice_number ?? ''} • Status: ${inv.payment_status ?? '-'} • Saldo: ${inv.balance ?? 0}`,
      };
      const { data: existing } = await admin
        .from('finance_transactions')
        .select('id')
        .eq('reference', reference)
        .maybeSingle();
      if (existing) {
        const { error } = await admin.from('finance_transactions').update(payload).eq('id', existing.id);
        if (!error) txUpdated++;
      } else {
        const { error } = await admin.from('finance_transactions').insert(payload);
        if (!error) txInserted++;
      }
      touchedCustomers.add(localCustomerId);
      if (inv.last_payment_date) {
        const prev = lastPaymentByCustomer.get(localCustomerId);
        if (!prev || inv.last_payment_date > prev) lastPaymentByCustomer.set(localCustomerId, inv.last_payment_date);
      }
    }

    // 3) Aggregate open + overdue balances from zoho_unpaid_invoices
    const { data: unpaid, error: upErr } = await admin
      .from('zoho_unpaid_invoices')
      .select('invoice_id, balance, due_date, raw');
    if (upErr) throw upErr;

    const balanceByCustomer = new Map<string, { open: number; overdue: number }>();
    const today = new Date().toISOString().slice(0, 10);
    // map zoho invoice id -> zoho customer id via raw or via zoho_invoices lookup
    const invCustMap = new Map<string, string>();
    for (const inv of invoices ?? []) invCustMap.set(String(inv.zoho_invoice_id), String(inv.customer_id ?? ''));

    for (const u of unpaid ?? []) {
      const zohoCustId = invCustMap.get(String(u.invoice_id)) || String((u.raw as any)?.customer_id ?? '');
      const localId = zohoCustId ? custMap.get(zohoCustId) : null;
      if (!localId) continue;
      const bal = Number(u.balance ?? 0);
      const overdue = u.due_date && u.due_date < today ? bal : 0;
      const cur = balanceByCustomer.get(localId) ?? { open: 0, overdue: 0 };
      cur.open += bal;
      cur.overdue += overdue;
      balanceByCustomer.set(localId, cur);
      touchedCustomers.add(localId);
    }

    // 4) Upsert finance_accounts for touched customers and update balances
    let accountsUpserted = 0;
    for (const localId of touchedCustomers) {
      const bal = balanceByCustomer.get(localId) ?? { open: 0, overdue: 0 };
      const lastPay = lastPaymentByCustomer.get(localId);
      const { data: acc } = await admin
        .from('finance_accounts')
        .select('id')
        .eq('customer_id', localId)
        .maybeSingle();
      const patch: Record<string, unknown> = {
        current_balance: bal.open,
        overdue_balance: bal.overdue,
        updated_at: new Date().toISOString(),
      };
      if (lastPay) patch.last_payment_at = lastPay;
      if (acc) {
        await admin.from('finance_accounts').update(patch).eq('id', acc.id);
      } else {
        await admin.from('finance_accounts').insert({ customer_id: localId, ...patch });
      }
      accountsUpserted++;
    }

    return new Response(JSON.stringify({
      success: true,
      duration_ms: Date.now() - started,
      invoices_seen: invoices?.length ?? 0,
      tx_inserted: txInserted,
      tx_updated: txUpdated,
      tx_skipped_no_customer: txSkipped,
      unpaid_seen: unpaid?.length ?? 0,
      accounts_upserted: accountsUpserted,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
