// FIBU LIGHT – SMS-Versand an Kunden mit offenen Posten (Twilio)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const TWILIO_FROM = Deno.env.get('TWILIO_SMS_FROM_NUMBER')
  || Deno.env.get('TWILIO_FROM_SMS')
  || Deno.env.get('TWILIO_FROM_NUMBER')
  || '';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';
const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY') ?? '';
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

const ALLOWED = ['Super Admin', 'Admin', 'Finance', 'FIBU LIGHT', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'];

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function normalizePhone(raw: string): string | null {
  let p = String(raw ?? '').trim().replace(/[^\d+]/g, '');
  if (!p) return null;
  if (p.startsWith('00')) p = `+${p.slice(2)}`;
  else if (p.startsWith('0')) p = `+49${p.slice(1)}`;
  else if (!p.startsWith('+')) p = `+${p}`;
  return /^\+[1-9]\d{6,14}$/.test(p) ? p : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { data: roleRows } = await admin.from('user_roles').select('roles(name)').eq('user_id', user.id);
    const roleNames = (roleRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    if (!roleNames.some((n: string) => ALLOWED.includes(n))) return json({ error: 'Keine Berechtigung' }, 403);

    const body = await req.json().catch(() => ({}));
    const to = normalizePhone(String(body?.to ?? ''));
    const text = String(body?.message ?? '').trim().slice(0, 600);
    if (!to) return json({ error: 'Keine gültige Mobilnummer' }, 400);
    if (!text) return json({ error: 'Nachricht fehlt' }, 400);
    if (!TWILIO_FROM) return json({ error: 'SMS-Absender fehlt (TWILIO_SMS_FROM_NUMBER)' }, 400);

    const params = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: text });

    let res: Response;
    if (LOVABLE_API_KEY && TWILIO_API_KEY) {
      res = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': TWILIO_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });
    } else if (TWILIO_SID && TWILIO_TOKEN) {
      res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });
    } else {
      return json({ error: 'Twilio ist nicht konfiguriert' }, 400);
    }

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`twilio failed [${res.status}]: ${errorBody}`);
      let code: number | null = null;
      try { code = JSON.parse(errorBody)?.code ?? null; } catch { /* ignore */ }
      const reason = code === 21408
        ? 'SMS in dieses Land ist bei Twilio nicht freigeschaltet (Geo-Berechtigung)'
        : code === 21211 ? 'Ungültige Mobilnummer' : 'SMS-Versand fehlgeschlagen';
      return json({ success: false, error: reason, twilio_code: code, status: res.status, details: errorBody }, 200);
    }
    const payload = await res.json().catch(() => ({}));
    return json({ success: true, sid: payload?.sid ?? null, to });
  } catch (e: any) {
    console.error('op-light-send-sms error', e);
    return json({ error: e?.message ?? 'Unbekannter Fehler' }, 500);
  }
});
