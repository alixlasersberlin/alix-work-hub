// ALIX COLLECT – Bankabgleich: ordnet Zahlungseingänge offenen Collect-Positionen zu
// und schließt bezahlte Fälle automatisch.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const ALLOWED = ['Super Admin', 'Admin', 'Finance', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'];

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const norm = (s: unknown) =>
  String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Cron darf ohne User laufen (x-cron-secret), sonst Rollenprüfung
    const cronSecret = req.headers.get('x-cron-secret');
    const isCron = !!cronSecret && cronSecret === (Deno.env.get('CRON_SECRET') ?? '');

    if (!isCron) {
      const authHeader = req.headers.get('Authorization') ?? '';
      if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const { data: rolesRows } = await admin.from('user_roles').select('roles(name)').eq('user_id', user.id);
      const roleNames = (rolesRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
      if (!roleNames.some((n: string) => ALLOWED.includes(n))) return json({ error: 'Keine Berechtigung' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body?.days ?? 120), 1), 365);
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    // 1. Zahlungseingänge laden (Gutschriften)
    const { data: txs, error: txErr } = await admin
      .from('bank_transactions')
      .select('id, booking_date, amount, currency, sender_receiver_name, purpose, invoice_number_hint, end_to_end_reference, customer_reference, is_return_debit')
      .gte('booking_date', since)
      .gt('amount', 0)
      .neq('is_return_debit', true)
      .order('booking_date', { ascending: false })
      .limit(2000);
    if (txErr) throw new Error(txErr.message);

    // 2. Bereits verarbeitete Transaktionen ausfiltern
    const { data: doneEvents } = await admin
      .from('collect_events')
      .select('meta')
      .eq('event_type', 'payment_matched')
      .limit(5000);
    const done = new Set(
      (doneEvents ?? []).map((e: any) => e?.meta?.bank_tx_id).filter(Boolean),
    );

    // 3. Offene Positionen laden
    const { data: items } = await admin
      .from('collect_case_items')
      .select('id, case_id, invoice_number, balance, currency')
      .gt('balance', 0)
      .limit(5000);
    const { data: cases } = await admin
      .from('collect_cases')
      .select('id, customer_name, status')
      .neq('status', 'closed')
      .limit(3000);

    const byInvoice = new Map<string, any>();
    for (const it of items ?? []) {
      const key = norm(it.invoice_number);
      if (key) byInvoice.set(key, it);
    }
    const caseByName = new Map<string, any>();
    for (const c of cases ?? []) {
      const key = norm(c.customer_name);
      if (key) caseByName.set(key, c);
    }
    const itemsByCase = new Map<string, any[]>();
    for (const it of items ?? []) {
      const arr = itemsByCase.get(it.case_id) ?? [];
      arr.push(it);
      itemsByCase.set(it.case_id, arr);
    }

    let matched = 0;
    let unmatched = 0;
    let closed = 0;
    const touchedCases = new Set<string>();

    for (const tx of txs ?? []) {
      if (done.has(tx.id)) continue;

      const haystack = norm(`${tx.purpose ?? ''} ${tx.invoice_number_hint ?? ''} ${tx.end_to_end_reference ?? ''} ${tx.customer_reference ?? ''}`);
      let item: any = null;
      let confidence = 0;

      // a) Rechnungsnummer im Verwendungszweck
      for (const [key, it] of byInvoice) {
        if (key.length >= 5 && haystack.includes(key)) { item = it; confidence = 95; break; }
      }

      // b) Kundenname + exakter Betrag
      if (!item) {
        const payer = norm(tx.sender_receiver_name);
        if (payer.length >= 4) {
          for (const [key, c] of caseByName) {
            if (!key.includes(payer) && !payer.includes(key)) continue;
            const candidates = itemsByCase.get(c.id) ?? [];
            const exact = candidates.find((i) => Math.abs(Number(i.balance) - Number(tx.amount)) < 0.01);
            if (exact) { item = exact; confidence = 80; break; }
          }
        }
      }

      if (!item) { unmatched++; continue; }

      const newBalance = Math.max(0, Number(item.balance) - Number(tx.amount));
      await admin.from('collect_case_items')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', item.id);
      item.balance = newBalance;

      await admin.from('collect_events').insert({
        case_id: item.case_id,
        event_type: 'payment_matched',
        channel: 'bank',
        direction: 'inbound',
        subject: `Zahlungseingang ${Number(tx.amount).toFixed(2)} ${tx.currency ?? 'EUR'}`,
        body: `Rechnung ${item.invoice_number ?? '—'} · ${tx.sender_receiver_name ?? ''} · ${tx.purpose ?? ''}`.slice(0, 900),
        automated: true,
        occurred_at: tx.booking_date ? new Date(tx.booking_date).toISOString() : new Date().toISOString(),
        meta: { bank_tx_id: tx.id, amount: tx.amount, confidence, invoice_number: item.invoice_number },
      });

      matched++;
      touchedCases.add(item.case_id);
    }

    // 4. Betroffene Fälle neu berechnen
    for (const caseId of touchedCases) {
      const { data: rest } = await admin
        .from('collect_case_items')
        .select('balance, days_overdue, due_date')
        .eq('case_id', caseId);
      const open = (rest ?? []).reduce((a: number, r: any) => a + Number(r.balance ?? 0), 0);
      const overdue = (rest ?? [])
        .filter((r: any) => Number(r.days_overdue ?? 0) > 0)
        .reduce((a: number, r: any) => a + Number(r.balance ?? 0), 0);
      const maxDays = (rest ?? []).reduce((a: number, r: any) => Math.max(a, Number(r.days_overdue ?? 0)), 0);

      const patch: Record<string, unknown> = {
        open_amount: open,
        overdue_amount: overdue,
        max_days_overdue: open > 0 ? maxDays : 0,
        updated_at: new Date().toISOString(),
      };
      if (open <= 0.01) {
        patch.status = 'closed';
        patch.ampel = 'gruen';
        patch.next_action = null;
        patch.next_action_at = null;
        closed++;
        await admin.from('collect_events').insert({
          case_id: caseId,
          event_type: 'case_closed',
          channel: 'bank',
          subject: 'Fall automatisch geschlossen (vollständig bezahlt)',
          automated: true,
        });
        await admin.from('collect_tasks').update({ status: 'done' })
          .eq('case_id', caseId).neq('status', 'done');
      }
      await admin.from('collect_cases').update(patch).eq('id', caseId);
    }

    return json({ success: true, checked: (txs ?? []).length, matched, unmatched, cases_updated: touchedCases.size, closed });
  } catch (e: any) {
    console.error('collect-bank-match error', e);
    return json({ error: e?.message ?? 'Unbekannter Fehler' }, 500);
  }
});
