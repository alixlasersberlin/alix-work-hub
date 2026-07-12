// Sendet eine Anzahlungsrechnungs-Mahnung manuell per E-Mail oder SMS.
// Channel: 'email' | 'sms'. stage_id optional (sonst erste aktive Stufe).
// Konfiguration kommt aus app_settings.key='anzahlung_mahnung_config'.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

const ENV_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const ENV_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const ENV_SMS_FROM = Deno.env.get('TWILIO_SMS_FROM_NUMBER') ?? '';
const ENV_WA_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM_NUMBER') ?? '';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const ALLOWED_ROLES = new Set([
  'Super Admin', 'Admin', 'Finance', 'Finanzierungen', 'Vertrieb', 'Kundenservice', 'Auftragsverwaltung', 'Order', 'SACHBEARBEITUNG',
]);

type MahnStage = {
  id: string; name: string; days_after_due: number; enabled: boolean;
  email_subject: string; email_body: string; sms_body: string;
};
type MahnConfig = {
  sender: { email_from: string; email_from_name: string; sms_sender: string };
  bank: { account_holder: string; bank_name: string; iban: string; bic: string };
  stages: MahnStage[];
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function normE164(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('0')) s = '+49' + s.slice(1);
  if (!s.startsWith('+')) s = '+' + s;
  return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

function applyTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

async function loadConfig(): Promise<MahnConfig | null> {
  const { data } = await admin.from('app_settings').select('value').eq('key', 'anzahlung_mahnung_config').maybeSingle();
  if (!data?.value) return null;
  try { return JSON.parse(data.value) as MahnConfig; } catch { return null; }
}

async function loadTwilio(cfgSender?: string) {
  const { data } = await admin.from('sms_settings').select('account_sid, auth_token, from_number').eq('id', true).maybeSingle();
  return {
    sid: (data?.account_sid?.trim()) || ENV_SID,
    token: (data?.auth_token?.trim()) || ENV_TOKEN,
    // Bevorzuge expliziten Sender aus Konfig (alphanumerische Sender-ID wie "ALIXLASERS")
    from: (cfgSender?.trim()) || (data?.from_number?.trim()) || ENV_SMS_FROM || ENV_WA_FROM.replace(/^whatsapp:/i, ''),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: claims, error: cerr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (cerr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub as string;

    const { data: roleRows } = await admin.from('user_roles').select('roles!inner(name)').eq('user_id', userId);
    const roleNames = (roleRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    if (!roleNames.some((n: string) => ALLOWED_ROLES.has(n))) return json({ error: 'Forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const { order_id, channel, stage_id } = body ?? {};
    if (!order_id || (channel !== 'email' && channel !== 'sms')) {
      return json({ error: 'order_id und channel (email|sms) erforderlich' }, 400);
    }

    const cfg = await loadConfig();
    const stages = (cfg?.stages ?? []).filter(s => s.enabled);
    const stage = stage_id
      ? stages.find(s => s.id === stage_id)
      : stages[0];
    if (!stage) return json({ error: 'Keine aktive Mahnstufe konfiguriert. Bitte in OPERATIONS → Anzahlungs-Mahnung Konfiguration anlegen.' }, 400);

    // Load order + customer
    const { data: order, error: oerr } = await admin
      .from('orders')
      .select('id, order_number, source_system, deposit_amount, deposit_ok_at, customer_id, salesperson_name')
      .eq('id', order_id).maybeSingle();
    if (oerr || !order) return json({ error: 'Auftrag nicht gefunden' }, 404);
    if (!order.customer_id) return json({ error: 'Auftrag hat keinen Kunden' }, 400);

    const { data: cust } = await admin
      .from('customers')
      .select('id, company_name, contact_name, email, phone')
      .eq('id', order.customer_id).maybeSingle();
    if (!cust) return json({ error: 'Kunde nicht gefunden' }, 404);
    const { data: custBank } = await admin
      .from('customer_bank_details')
      .select('iban, bic, bank_name')
      .eq('customer_id', order.customer_id)
      .maybeSingle();

    const customerName = cust.company_name || cust.contact_name || '';
    const orderNumber = order.order_number ?? '';
    const depositAmount = Number(order.deposit_amount ?? 0);
    const depositOkDate = order.deposit_ok_at ? new Date(order.deposit_ok_at).toLocaleDateString('de-DE') : '';

    // Bankverbindung: Kundendaten überschreiben Konfig (falls beim Kunden gepflegt), sonst aus Konfig,
    // als letzten Fallback die feste Alix Lasers GmbH Bankverbindung.
    const DEFAULT_BANK = { name: 'Deutsche Bank', iban: 'DE07100701000142660000', bic: 'DEUTDEBB101' };
    const iban = (custBank?.iban ?? '') || (cfg?.bank.iban ?? '') || DEFAULT_BANK.iban;
    const bic = (custBank?.bic ?? '') || (cfg?.bank.bic ?? '') || DEFAULT_BANK.bic;
    const bankName = (custBank?.bank_name ?? '') || (cfg?.bank.bank_name ?? '') || DEFAULT_BANK.name;

    const senderName = order.salesperson_name || cfg?.sender.email_from_name || 'Alix Lasers';

    const vars: Record<string, string> = {
      customerName, orderNumber, depositAmount: fmtEur(depositAmount),
      depositOkDate, iban, bic, bankName, senderName,
    };

    if (channel === 'email') {
      const recipient = (cust.email ?? '').trim();
      if (!recipient) return json({ error: 'Kunde hat keine E-Mail-Adresse' }, 400);

      const subject = applyTemplate(stage.email_subject, vars);
      const bodyText = applyTemplate(stage.email_body, vars);

      const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          apikey: ANON,
        },
        body: JSON.stringify({
          templateName: 'anzahlung-mahnung',
          recipientEmail: recipient,
          idempotencyKey: `anz-mahnung-${order_id}-${stage.id}-${Date.now()}`,
          templateData: {
            subject,
            bodyText,
            stageName: stage.name,
            customerName, orderNumber, depositAmount, depositOkDate,
            iban, bic, bankName, senderName,
          },
        }),
      });
      const sendBody = await sendRes.json().catch(() => ({}));
      const ok = sendRes.ok;
      await admin.from('customer_communication_log').insert({
        customer_id: cust.id, order_id, channel: 'email', direction: 'outbound',
        subject,
        preview: bodyText.slice(0, 200),
        department: 'Finance', created_by: userId,
        metadata: {
          type: 'anzahlung_mahnung', stage_id: stage.id, stage_name: stage.name,
          status: ok ? 'sent' : 'failed', recipient,
          message_id: ok ? (sendBody?.message_id ?? null) : null,
          error: ok ? null : sendBody,
        },
      });
      if (!ok) return json({ ok: false, error: `E-Mail-Versand fehlgeschlagen (${sendRes.status})` }, 502);
      return json({ ok: true, channel: 'email', recipient, stage: stage.name });
    }

    // SMS
    const phoneRaw = (cust.phone ?? '').toString();
    const to = normE164(phoneRaw);
    if (!to) return json({ error: 'Kunde hat keine gültige Mobilnummer' }, 400);

    const tw = await loadTwilio(cfg?.sender.sms_sender);
    if (!tw.sid || !tw.token || !tw.from) return json({ error: 'Twilio-Zugangsdaten unvollständig' }, 500);

    const text = applyTemplate(stage.sms_body, vars);

    const url = `https://api.twilio.com/2010-04-01/Accounts/${tw.sid}/Messages.json`;
    const basic = btoa(`${tw.sid}:${tw.token}`);
    const form = new URLSearchParams({ To: to, From: tw.from, Body: text });
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const data = await res.json();
    const ok = res.ok;
    await admin.from('customer_communication_log').insert({
      customer_id: cust.id, order_id, channel: 'sms', direction: 'outbound',
      subject: `Anzahlungs-Mahnung (${stage.name}) ${orderNumber}`,
      preview: text.slice(0, 160),
      department: 'Finance', created_by: userId,
      metadata: {
        type: 'anzahlung_mahnung', stage_id: stage.id, stage_name: stage.name,
        status: ok ? 'sent' : 'failed', recipient: to,
        twilio_sid: ok ? (data?.sid ?? null) : null,
        error: ok ? null : `Twilio ${res.status}: ${data?.message ?? ''}`,
      },
    });
    if (!ok) return json({ ok: false, error: `Twilio ${res.status}: ${data?.message ?? ''}` }, 502);
    return json({ ok: true, channel: 'sms', recipient: to, sid: data?.sid, stage: stage.name });
  } catch (e: any) {
    return json({ error: e?.message ?? 'Unbekannter Fehler' }, 500);
  }
});
