// ALIX COLLECT – SMS/WhatsApp-Eskalation über Twilio
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const TWILIO_FROM = Deno.env.get('TWILIO_PHONE_NUMBER') ?? '';
const TWILIO_WA_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM') ?? '';

const ALLOWED = ['Super Admin', 'Admin', 'Finance', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'];

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function normalizePhone(raw: string): string | null {
  let p = String(raw ?? '').replace(/[^\d+]/g, '');
  if (!p) return null;
  if (p.startsWith('00')) p = `+${p.slice(2)}`;
  if (!p.startsWith('+')) p = p.startsWith('0') ? `+49${p.slice(1)}` : `+${p}`;
  return p.length >= 8 ? p : null;
}

const money = (n: unknown, cur = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur || 'EUR' }).format(Number(n) || 0);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const cronSecret = req.headers.get('x-cron-secret');
    const isCron = !!cronSecret && cronSecret === (Deno.env.get('CRON_SECRET') ?? '');
    let actor: string | null = null;

    if (!isCron) {
      const authHeader = req.headers.get('Authorization') ?? '';
      if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: 'Unauthorized' }, 401);
      actor = user.id;
      const { data: rolesRows } = await admin.from('user_roles').select('roles(name)').eq('user_id', user.id);
      const roleNames = (rolesRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
      if (!roleNames.some((n: string) => ALLOWED.includes(n))) return json({ error: 'Keine Berechtigung' }, 403);
    }

    if (!TWILIO_SID || !TWILIO_TOKEN) return json({ error: 'Twilio ist nicht konfiguriert' }, 400);

    const body = await req.json().catch(() => ({}));
    const caseId: string = body?.case_id ?? '';
    const channel: 'sms' | 'whatsapp' = body?.channel === 'whatsapp' ? 'whatsapp' : 'sms';
    if (!caseId) return json({ error: 'case_id erforderlich' }, 400);

    const { data: c } = await admin.from('collect_cases').select('*').eq('id', caseId).maybeSingle();
    if (!c) return json({ error: 'Fall nicht gefunden' }, 404);

    const phone = normalizePhone(body?.to || c.customer_phone || '');
    if (!phone) return json({ error: 'Keine gültige Telefonnummer hinterlegt' }, 400);

    const amount = money(c.open_amount, c.currency ?? 'EUR');
    const text: string = String(
      body?.message
      || `Alix Lasers: Offener Betrag ${amount} (Verzug ${c.max_days_overdue ?? 0} Tage). `
        + `Bitte begleichen Sie den Betrag oder kontaktieren Sie uns unter finance@alixwork.de.`,
    ).slice(0, 600);

    const from = channel === 'whatsapp' ? (TWILIO_WA_FROM || `whatsapp:${TWILIO_FROM}`) : TWILIO_FROM;
    if (!from) return json({ error: 'Twilio-Absender fehlt' }, 400);

    const params = new URLSearchParams({
      To: channel === 'whatsapp' ? `whatsapp:${phone}` : phone,
      From: from.startsWith('whatsapp:') || channel === 'sms' ? from : `whatsapp:${from}`,
      Body: text,
    });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('twilio error', res.status, JSON.stringify(payload));
      return json({ error: payload?.message ?? 'Twilio-Fehler', status: res.status }, res.status);
    }

    await admin.from('collect_events').insert({
      case_id: caseId,
      event_type: channel === 'whatsapp' ? 'whatsapp_sent' : 'sms_sent',
      channel,
      direction: 'outbound',
      subject: `${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} an ${phone}`,
      body: text,
      actor,
      automated: isCron,
      meta: { sid: payload?.sid, to: phone },
    });
    await admin.from('collect_cases').update({
      last_contact_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', caseId);

    return json({ success: true, sid: payload?.sid, to: phone, channel });
  } catch (e: any) {
    console.error('collect-send-sms error', e);
    return json({ error: e?.message ?? 'Unbekannter Fehler' }, 500);
  }
});
