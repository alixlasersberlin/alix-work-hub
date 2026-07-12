// Edge Function: dispatch-eta-sms
// Sendet dem Kunden eine ETA-SMS via Twilio (Connector-Gateway) und protokolliert
// den Versand in customer_communication_log. Aufruf durch Techniker aus /m/einsatz.
//
// Body: { route_plan_id: string, eta_minutes: number }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { z } from 'https://esm.sh/zod@3.23.8';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const Body = z.object({
  route_plan_id: z.string().uuid(),
  eta_minutes: z.number().int().min(1).max(480),
});

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
    const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER');
    if (!LOVABLE_API_KEY) return json({ error: 'LOVABLE_API_KEY missing' }, 500);
    if (!TWILIO_API_KEY) return json({ error: 'TWILIO_API_KEY missing – Twilio-Connector nicht verknüpft' }, 500);
    if (!TWILIO_FROM) return json({ error: 'TWILIO_FROM_NUMBER Secret fehlt' }, 500);

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'unauthorized' }, 401);
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: { user } } = await supa.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return json({ error: 'unauthorized' }, 401);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { route_plan_id, eta_minutes } = parsed.data;

    const { data: rp } = await supa.from('route_plans')
      .select('id, customer_id, contact_name, contact_phone, address_line, zip, city')
      .eq('id', route_plan_id).maybeSingle();
    if (!rp) return json({ error: 'route_plan not found' }, 404);
    if (!rp.contact_phone) {
      return json({ error: 'Keine Telefonnummer beim Einsatz hinterlegt' }, 422);
    }

    const to = normalizePhone(rp.contact_phone);
    if (!to) return json({ error: `Ungültige Telefonnummer: ${rp.contact_phone}` }, 422);

    const etaAt = new Date(Date.now() + eta_minutes * 60_000);
    const etaLocal = etaAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
    const message = `Ihr Techniker ist unterwegs und wird gegen ${etaLocal} Uhr eintreffen. – Alix Lasers`;

    const twilioRes = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TWILIO_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: message }),
    });
    const twilioBody = await twilioRes.text();
    let twilioJson: any = {};
    try { twilioJson = JSON.parse(twilioBody); } catch { /* keep raw */ }

    const ok = twilioRes.ok && !twilioJson?.error_code;
    await supa.from('route_plans').update({ eta_at: etaAt.toISOString() } as any).eq('id', route_plan_id);
    if (rp.customer_id) {
      await supa.from('customer_communication_log').insert({
        customer_id: rp.customer_id,
        channel: 'sms',
        direction: 'outbound',
        subject: 'ETA-Benachrichtigung Techniker',
        body: message,
        status: ok ? 'sent' : 'failed',
        metadata: {
          source: 'dispatch-eta-sms',
          route_plan_id,
          eta_at: etaAt.toISOString(),
          to,
          from: TWILIO_FROM,
          twilio_sid: twilioJson?.sid ?? null,
          twilio_status: twilioJson?.status ?? null,
          twilio_error: twilioJson?.message ?? (ok ? null : twilioBody.slice(0, 500)),
          sent_by: user.id,
        },
      } as any);
    }

    if (!ok) {
      return json({ error: 'Twilio-Versand fehlgeschlagen', status: twilioRes.status, details: twilioJson || twilioBody }, 502);
    }
    return json({ ok: true, sid: twilioJson.sid, eta_at: etaAt.toISOString(), to });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
}

// Normalisiert DE/AT-Nummern zu E.164. Nimmt bereits E.164 an, wandelt 0-prefixed
// Nummern in +49 um (Default DE); wählbar mit country-Präfix.
function normalizePhone(raw: string, defaultCountry = '49'): string | null {
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (/^\+[1-9]\d{6,14}$/.test(cleaned)) return cleaned;
  if (cleaned.startsWith('00')) {
    const rest = cleaned.slice(2);
    return /^[1-9]\d{6,14}$/.test(rest) ? `+${rest}` : null;
  }
  if (cleaned.startsWith('0')) {
    const rest = cleaned.slice(1);
    return /^[1-9]\d{5,13}$/.test(rest) ? `+${defaultCountry}${rest}` : null;
  }
  if (/^[1-9]\d{6,14}$/.test(cleaned)) return `+${cleaned}`;
  return null;
}
