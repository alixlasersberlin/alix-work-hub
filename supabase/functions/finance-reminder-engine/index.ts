// Phase 3 Mahnwesen: erstellt Mahnungs-Entwürfe (Status "Entwurf") basierend auf
// offenen finance_transactions (Typ "Rechnung") und der Mahn-Konfiguration in
// app_settings.key = 'finance.reminder.config'. Versendet NICHTS automatisch.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const DEFAULT_CFG = {
  levels: [
    { level: 1, days: 14, fee: 0, interest_pct: 0 },
    { level: 2, days: 28, fee: 5, interest_pct: 0 },
    { level: 3, days: 42, fee: 10, interest_pct: 5 },
    { level: 4, days: 56, fee: 15, interest_pct: 9 },
  ],
  payment_window_days: 7,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const started = Date.now();
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load config
    const { data: cfgRow } = await admin.from('app_settings').select('value').eq('key', 'finance.reminder.config').maybeSingle();
    let cfg = DEFAULT_CFG;
    try { if (cfgRow?.value) cfg = { ...DEFAULT_CFG, ...JSON.parse(cfgRow.value) }; } catch { /* ignore */ }
    const levels = (cfg.levels ?? DEFAULT_CFG.levels).sort((a: any, b: any) => a.level - b.level);

    // Pull open invoices: finance_transactions of type "Rechnung" whose customer has overdue_balance > 0
    const { data: accounts } = await admin
      .from('finance_accounts')
      .select('id, customer_id, reminder_level, overdue_balance')
      .gt('overdue_balance', 0);

    const today = new Date();
    const ymd = (d: Date) => d.toISOString().slice(0, 10);

    let created = 0, skipped = 0;
    for (const acc of accounts ?? []) {
      // Skip if there is already an Entwurf or unsent reminder
      const { data: pending } = await admin
        .from('finance_reminders')
        .select('id')
        .eq('customer_id', acc.customer_id)
        .eq('status', 'Entwurf')
        .limit(1);
      if (pending && pending.length > 0) { skipped++; continue; }

      // Get open invoices for this customer
      const { data: txs } = await admin
        .from('finance_transactions')
        .select('id, amount, booking_date, notes, reference')
        .eq('customer_id', acc.customer_id)
        .eq('transaction_type', 'Rechnung');
      const items = (txs ?? []).map((t) => {
        const due = t.booking_date ? new Date(t.booking_date) : null;
        const days_overdue = due ? Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000)) : 0;
        return { transaction_id: t.id, amount: Number(t.amount ?? 0), due_date: t.booking_date, days_overdue, invoice_number: extractInvoiceNumber(t.notes) };
      }).filter((it) => it.days_overdue > 0);
      if (items.length === 0) { skipped++; continue; }

      const maxOverdue = Math.max(...items.map((i) => i.days_overdue));
      const nextLevel = chooseLevel(levels, acc.reminder_level ?? 0, maxOverdue);
      if (!nextLevel) { skipped++; continue; }

      const amount = Number(acc.overdue_balance);
      const fee = Number(nextLevel.fee ?? 0);
      const interest = amount * (Number(nextLevel.interest_pct ?? 0) / 100) * (maxOverdue / 365);
      const total = amount + fee + interest;

      const { data: rem, error: insErr } = await admin
        .from('finance_reminders')
        .insert({
          customer_id: acc.customer_id,
          level: nextLevel.level,
          amount,
          fee,
          interest: Math.round(interest * 100) / 100,
          total: Math.round(total * 100) / 100,
          due_date: ymd(new Date(today.getTime() + (cfg.payment_window_days ?? 7) * 86400000)),
          status: 'Entwurf',
          notes: `Auto-generiert vom Mahn-Engine`,
        })
        .select('id')
        .single();
      if (insErr || !rem) { skipped++; continue; }

      await admin.from('finance_reminder_items').insert(
        items.map((it) => ({
          reminder_id: rem.id,
          transaction_id: it.transaction_id,
          invoice_number: it.invoice_number,
          amount: it.amount,
          due_date: it.due_date,
          days_overdue: it.days_overdue,
        }))
      );
      created++;
    }

    return new Response(JSON.stringify({
      success: true,
      duration_ms: Date.now() - started,
      accounts_seen: accounts?.length ?? 0,
      drafts_created: created,
      skipped,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function chooseLevel(levels: any[], currentLevel: number, daysOverdue: number) {
  // Find highest level whose days threshold is reached and > currentLevel
  const candidates = levels.filter((l) => daysOverdue >= l.days && l.level > currentLevel);
  if (candidates.length === 0) return null;
  return candidates[candidates.length - 1];
}

function extractInvoiceNumber(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/Zoho\s+(\S+)/);
  return m ? m[1] : null;
}
