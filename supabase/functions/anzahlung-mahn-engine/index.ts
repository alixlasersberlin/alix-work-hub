// Automatische Mahnung offener Anzahlungen (täglicher Cron).
// Liest finance_deposits (open_amount > 0, due_date überfällig), ermittelt die passende
// Mahnstufe aus app_settings.key='anzahlung_mahnung_config' und versendet je Stufe genau
// eine E-Mail. Doppelversand wird über customer_communication_log verhindert.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type MahnStage = {
  id: string; name: string; days_after_due: number; enabled: boolean;
  email_subject: string; email_body: string; sms_body: string;
};
type MahnConfig = {
  sender?: { email_from?: string; email_from_name?: string; sms_sender?: string };
  bank?: { account_holder?: string; bank_name?: string; iban?: string; bic?: string };
  stages?: MahnStage[];
  /** Automatikversand aktiv? Standard: true, sobald Stufen konfiguriert sind. */
  auto_enabled?: boolean;
};

const DEFAULT_BANK = { name: 'Deutsche Bank', iban: 'DE07100701000142660000', bic: 'DEUTDEBB101' };

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function fmtEur(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}
function applyTemplate(tpl: string, vars: Record<string, string>): string {
  return (tpl || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}
function daysOverdue(due: string | null): number {
  if (!due) return -1;
  const d = new Date(due + (due.length <= 10 ? 'T00:00:00Z' : ''));
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;

    const { data: cfgRow } = await admin.from('app_settings').select('value')
      .eq('key', 'anzahlung_mahnung_config').maybeSingle();
    let cfg: MahnConfig | null = null;
    try { cfg = cfgRow?.value ? JSON.parse(cfgRow.value) as MahnConfig : null; } catch { cfg = null; }

    const stages = (cfg?.stages ?? []).filter(s => s.enabled)
      .sort((a, b) => Number(a.days_after_due) - Number(b.days_after_due));
    if (!stages.length) return json({ ok: true, skipped: 'Keine aktive Mahnstufe konfiguriert', sent: 0 });
    if (cfg?.auto_enabled === false) return json({ ok: true, skipped: 'Automatik deaktiviert', sent: 0 });

    const { data: deposits } = await admin
      .from('finance_deposits')
      .select('id, deposit_number, order_id, order_number, customer_id, company_name, customer_name, open_amount, due_date, status')
      .gt('open_amount', 0)
      .not('due_date', 'is', null)
      .lt('due_date', new Date().toISOString().slice(0, 10))
      .limit(500);

    const results: any[] = [];
    let sent = 0;

    for (const dep of deposits ?? []) {
      const od = daysOverdue(dep.due_date);
      const stage = [...stages].reverse().find(s => od >= Number(s.days_after_due ?? 0));
      if (!stage) continue;
      if (!dep.customer_id) { results.push({ deposit: dep.deposit_number, skipped: 'kein Kunde' }); continue; }

      // Doppelversand je Stufe verhindern
      const { data: prev } = await admin
        .from('customer_communication_log')
        .select('id, metadata')
        .eq('customer_id', dep.customer_id)
        .eq('channel', 'email')
        .contains('metadata', { type: 'anzahlung_mahnung', stage_id: stage.id, deposit_id: dep.id })
        .limit(1);
      if (prev?.length) { results.push({ deposit: dep.deposit_number, stage: stage.name, skipped: 'bereits gemahnt' }); continue; }

      const { data: cust } = await admin.from('customers')
        .select('id, company_name, contact_name, email').eq('id', dep.customer_id).maybeSingle();
      const recipient = (cust?.email ?? '').trim();
      if (!recipient) { results.push({ deposit: dep.deposit_number, skipped: 'keine E-Mail' }); continue; }

      const { data: custBank } = await admin.from('customer_bank_details')
        .select('iban, bic, bank_name').eq('customer_id', dep.customer_id).maybeSingle();

      const vars: Record<string, string> = {
        customerName: dep.company_name || cust?.company_name || cust?.contact_name || dep.customer_name || '',
        orderNumber: dep.order_number || dep.deposit_number || '',
        depositAmount: fmtEur(Number(dep.open_amount ?? 0)),
        depositOkDate: dep.due_date ? new Date(dep.due_date).toLocaleDateString('de-DE') : '',
        iban: custBank?.iban || cfg?.bank?.iban || DEFAULT_BANK.iban,
        bic: custBank?.bic || cfg?.bank?.bic || DEFAULT_BANK.bic,
        bankName: custBank?.bank_name || cfg?.bank?.bank_name || DEFAULT_BANK.name,
        senderName: cfg?.sender?.email_from_name || 'Alix Lasers',
      };
      const subject = applyTemplate(stage.email_subject, vars);
      const bodyText = applyTemplate(stage.email_body, vars);

      if (dryRun) { results.push({ deposit: dep.deposit_number, stage: stage.name, recipient, would_send: true }); continue; }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE}`, apikey: ANON },
        body: JSON.stringify({
          templateName: 'anzahlung-mahnung',
          recipientEmail: recipient,
          idempotencyKey: `anz-auto-${dep.id}-${stage.id}`,
          templateData: {
            subject, bodyText, stageName: stage.name,
            customerName: vars.customerName, orderNumber: vars.orderNumber,
            depositAmount: Number(dep.open_amount ?? 0), depositOkDate: vars.depositOkDate,
            iban: vars.iban, bic: vars.bic, bankName: vars.bankName, senderName: vars.senderName,
          },
        }),
      });
      const sendBody = await res.json().catch(() => ({}));
      const ok = res.ok;

      await admin.from('customer_communication_log').insert({
        customer_id: dep.customer_id, order_id: dep.order_id, channel: 'email', direction: 'outbound',
        subject, preview: bodyText.slice(0, 200), department: 'Finance',
        metadata: {
          type: 'anzahlung_mahnung', auto: true, stage_id: stage.id, stage_name: stage.name,
          deposit_id: dep.id, deposit_number: dep.deposit_number, days_overdue: od,
          status: ok ? 'sent' : 'failed', recipient,
          message_id: ok ? (sendBody?.message_id ?? null) : null,
          error: ok ? null : sendBody,
        },
      });

      if (ok) sent++;
      results.push({ deposit: dep.deposit_number, stage: stage.name, recipient, ok });
    }

    return json({ ok: true, checked: deposits?.length ?? 0, sent, dry_run: dryRun, results });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
