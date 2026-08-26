// Phase 3 Mahnwesen: erstellt Mahnungs-Entwürfe (Status "Entwurf") basierend auf
// offenen finance_transactions (Typ "Rechnung") und der Mahn-Konfiguration in
// app_settings. Getrennte Buchungskreise: EU -> 'finance.reminder.config',
// CH -> 'finance.reminder.config.CH'. Versendet NICHTS automatisch.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getTenantScope } from '../_shared/tenant-scope.ts';

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

const cfgKey = (region: string) => region === 'CH' ? 'finance.reminder.config.CH' : 'finance.reminder.config';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const started = Date.now();
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const scope = await getTenantScope(req);
    const scopedIds = scope.restricted ? scope.tenantIds : null;
    if (scopedIds && scopedIds.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'kein Mandanten-Zugriff' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }
    const requested = String(body?.region ?? '').toUpperCase();
    const regions = requested === 'EU' || requested === 'CH' ? [requested] : ['EU', 'CH'];
    const onlyCustomerIds: string[] | null = Array.isArray(body?.customer_ids) && body.customer_ids.length > 0
      ? body.customer_ids.map((x: any) => String(x))
      : null;

    const today = new Date();
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    let seen = 0, created = 0, skipped = 0;
    const skipReasons = { already_has_draft: 0, no_overdue_items: 0, no_next_level: 0, insert_failed: 0 };
    const perRegion: Record<string, { accounts_seen: number; drafts_created: number; skipped: number }> = {};

    for (const region of regions) {
      let rSeen = 0, rCreated = 0, rSkipped = 0;

      // Load config for this accounting region
      const { data: cfgRow } = await admin.from('app_settings').select('value').eq('key', cfgKey(region)).maybeSingle();
      let cfg = DEFAULT_CFG;
      try { if (cfgRow?.value) cfg = { ...DEFAULT_CFG, ...JSON.parse(cfgRow.value) }; } catch { /* ignore */ }
      const levels = (cfg.levels ?? DEFAULT_CFG.levels).sort((a: any, b: any) => a.level - b.level);

      let accQ: any = admin
        .from('finance_accounts')
        .select('id, customer_id, reminder_level, overdue_balance')
        .eq('accounting_region', region)
        .gt('overdue_balance', 0);
      // Mandantenneutrale Altbestände (tenant_id NULL) sind laut tenant-scope.ts
      // ebenfalls zugelassen und dürfen nicht aus manuellen Läufen verschwinden.
      if (scopedIds) accQ = accQ.or(`tenant_id.in.(${scopedIds.join(',')}),tenant_id.is.null`);
      if (onlyCustomerIds) accQ = accQ.in('customer_id', onlyCustomerIds);
      const { data: accounts } = await accQ;
      rSeen = accounts?.length ?? 0;

      for (const acc of accounts ?? []) {
        // Skip if there is already an Entwurf or unsent reminder in this region
        const { data: pending } = await admin
          .from('finance_reminders')
          .select('id')
          .eq('customer_id', acc.customer_id)
          .eq('accounting_region', region)
          .eq('status', 'Entwurf')
          .limit(1);
        if (pending && pending.length > 0) { rSkipped++; skipReasons.already_has_draft++; continue; }

        // Get open invoices for this customer within the region
        const { data: txs } = await admin
          .from('finance_transactions')
          .select('id, amount, booking_date, notes, reference')
          .eq('customer_id', acc.customer_id)
          .eq('accounting_region', region)
          .eq('transaction_type', 'Rechnung');
        const items = (txs ?? []).map((t) => {
          const due = t.booking_date ? new Date(t.booking_date) : null;
          const days_overdue = due ? Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000)) : 0;
          return { transaction_id: t.id, amount: Number(t.amount ?? 0), due_date: t.booking_date, days_overdue, invoice_number: extractInvoiceNumber(t.notes) };
        }).filter((it) => it.days_overdue > 0);
        if (items.length === 0) { rSkipped++; skipReasons.no_overdue_items++; continue; }

        const maxOverdue = Math.max(...items.map((i) => i.days_overdue));
        const nextLevel = chooseLevel(levels, acc.reminder_level ?? 0, maxOverdue);
        if (!nextLevel) { rSkipped++; skipReasons.no_next_level++; continue; }

        const amount = Number(acc.overdue_balance);
        const fee = Number(nextLevel.fee ?? 0);
        const interest = amount * (Number(nextLevel.interest_pct ?? 0) / 100) * (maxOverdue / 365);
        const total = amount + fee + interest;

        const { data: rem, error: insErr } = await admin
          .from('finance_reminders')
          .insert({
            customer_id: acc.customer_id,
            accounting_region: region,
            level: nextLevel.level,
            amount,
            fee,
            interest: Math.round(interest * 100) / 100,
            total: Math.round(total * 100) / 100,
            due_date: ymd(new Date(today.getTime() + (cfg.payment_window_days ?? 7) * 86400000)),
            status: 'Entwurf',
            notes: `Auto-generiert vom Mahn-Engine (${region})`,
          })
          .select('id')
          .single();
        if (insErr || !rem) { rSkipped++; skipReasons.insert_failed++; continue; }

        await admin.from('finance_reminder_items').insert(
          items.map((it) => ({
            reminder_id: rem.id,
            accounting_region: region,
            transaction_id: it.transaction_id,
            invoice_number: it.invoice_number,
            amount: it.amount,
            due_date: it.due_date,
            days_overdue: it.days_overdue,
          }))
        );
        rCreated++;
      }

      perRegion[region] = { accounts_seen: rSeen, drafts_created: rCreated, skipped: rSkipped };
      seen += rSeen; created += rCreated; skipped += rSkipped;
    }

    return new Response(JSON.stringify({
      success: true,
      duration_ms: Date.now() - started,
      regions,
      per_region: perRegion,
      accounts_seen: seen,
      drafts_created: created,
      skipped,
      skip_reasons: skipReasons,
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
