// Edge Function: dispatch-eta-sms
// Sendet dem Kunden eine ETA-SMS via Twilio (Connector-Gateway) und protokolliert
// den Versand in customer_communication_log. Aufruf durch Techniker aus /m/einsatz.
//
// Body: { route_plan_id: string, eta_minutes: number }
// Template geladen aus app_settings key = 'sms.eta.template'
//   { de: string, at: string, sender?: string }
// Platzhalter: {{eta}} {{name}} {{sender}} {{city}}

import { z } from 'npm:zod@3';
import { corsHeaders as cors } from 'npm:@supabase/supabase-js@2/cors';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { DELIVERY_ROUTE_ROLES } from '../_shared/security-v42-scope.ts';

const Body = z.object({
  route_plan_id: z.string().uuid(),
  eta_minutes: z.number().int().min(1).max(480),
});

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';
const SETTING_KEY = 'sms.eta.template';

const DEFAULT_TEMPLATES = {
  de: 'Hallo {{name}}, Ihr Techniker ist unterwegs und wird gegen {{eta}} Uhr eintreffen. – {{sender}}',
  at: 'Hallo {{name}}, Ihr Techniker ist unterwegs und wird gegen {{eta}} Uhr bei Ihnen eintreffen. – {{sender}}',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const access = await requireCallerAccess(req, cors, [...DELIVERY_ROUTE_ROLES, 'Technik', 'Techniker', 'Service', 'Serviceleitung', 'Kundenservice']);
    if ('response' in access) return access.response;
    const supa = access.caller;
    const user = access.user;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
    const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER');
    if (!LOVABLE_API_KEY) return json({ error: 'LOVABLE_API_KEY missing' }, 500);
    if (!TWILIO_API_KEY) return json({ error: 'TWILIO_API_KEY missing – Twilio-Connector nicht verknüpft' }, 500);
    if (!TWILIO_FROM) return json({ error: 'TWILIO_FROM_NUMBER Secret fehlt' }, 500);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { route_plan_id, eta_minutes } = parsed.data;

    const { data: rp } = await supa.from('route_plans')
      .select('id, technician_user_id, customer_id, order_id, contact_name, contact_phone, address_line, zip, city')
      .eq('id', route_plan_id).maybeSingle();
    if (!rp) return json({ error: 'route_plan not found' }, 404);
    if (rp.technician_user_id !== user.id && !access.roles.some(role => DELIVERY_ROUTE_ROLES.includes(role))) return json({ error: 'Forbidden' }, 403);
    const { data: customer } = await supa.from('customers').select('id, source_system').eq('id', rp.customer_id).maybeSingle();
    if (!customer?.source_system || !access.tenants.some((tenant: { zoho_source_system: string | null }) => tenant.zoho_source_system === customer.source_system)) return json({ error: 'Forbidden' }, 403);
    if (!rp.contact_phone) {
      return json({ error: 'Keine Telefonnummer beim Einsatz hinterlegt' }, 422);
    }

    const to = normalizePhone(rp.contact_phone);
    if (!to) return json({ error: 'Ungültige gespeicherte Telefonnummer' }, 422);

    // Land bestimmen: order.source_system → 'zoho_eu_2' = AT, sonst DE
    let variant: 'de' | 'at' = 'de';
    if (rp.order_id) {
      const { data: ord } = await supa.from('orders')
        .select('source_system, customer_id').eq('id', rp.order_id).maybeSingle();
      if (!ord || ord.customer_id !== customer.id || ord.source_system !== customer.source_system) return json({ error: 'Forbidden' }, 403);
      if (ord?.source_system === 'zoho_eu_2') variant = 'at';
    }

    // Template laden
    const { data: cfgRow } = await supa.from('app_settings')
      .select('value').eq('key', SETTING_KEY).maybeSingle();
    let tpl = { ...DEFAULT_TEMPLATES, sender: 'AlixLasers' } as {
      de: string; at: string; sender: string;
    };
    if (cfgRow?.value) {
      try {
        const parsedCfg = typeof cfgRow.value === 'string' ? JSON.parse(cfgRow.value) : cfgRow.value;
        tpl = {
          de: parsedCfg?.de || DEFAULT_TEMPLATES.de,
          at: parsedCfg?.at || DEFAULT_TEMPLATES.at,
          sender: parsedCfg?.sender || 'AlixLasers',
        };
      } catch { /* keep defaults */ }
    }

    const etaAt = new Date(Date.now() + eta_minutes * 60_000);
    const etaLocal = etaAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
    const rawTpl = variant === 'at' ? tpl.at : tpl.de;
    const message = rawTpl
      .replaceAll('{{eta}}', etaLocal)
      .replaceAll('{{name}}', rp.contact_name || 'Kunde')
      .replaceAll('{{sender}}', tpl.sender)
      .replaceAll('{{city}}', rp.city || '');

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
    if (ok) await supa.from('route_plans').update({ eta_at: etaAt.toISOString() } as any).eq('id', route_plan_id);
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
          variant,
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
    return json({ ok: true, sid: twilioJson.sid, eta_at: etaAt.toISOString(), to, variant });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
}

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
