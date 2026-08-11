import "../_shared/global-bcc.ts";
// ALIX COLLECT – Zahl-Link erzeugen und optional per E-Mail an den Kunden senden
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = 'Alix Lasers ® <finance@alixwork.de>';
const APP_URL = 'https://app.alixwork.de';

const ALLOWED = ['Super Admin', 'Admin', 'Finance', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'];

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const money = (n: unknown, cur = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur || 'EUR' }).format(Number(n) || 0);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { data: rolesRows } = await admin.from('user_roles').select('roles(name)').eq('user_id', user.id);
    const roleNames = (rolesRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    if (!roleNames.some((n: string) => ALLOWED.includes(n))) return json({ error: 'Keine Berechtigung' }, 403);

    const body = await req.json().catch(() => ({}));
    const caseId: string = body?.case_id ?? '';
    if (!caseId) return json({ error: 'case_id erforderlich' }, 400);
    const validDays = Math.min(Math.max(Number(body?.valid_days ?? 30), 1), 180);
    const allowInstallments = body?.allow_installments !== false;
    const send = !!body?.send;

    const { data: c } = await admin.from('collect_cases').select('*').eq('id', caseId).maybeSingle();
    if (!c) return json({ error: 'Fall nicht gefunden' }, 404);

    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const expires = new Date(Date.now() + validDays * 86400000).toISOString();
    const amount = Number(body?.amount ?? c.open_amount ?? 0);

    const { data: link, error: insErr } = await admin.from('collect_payment_links').insert({
      case_id: caseId,
      customer_id: c.customer_id,
      customer_name: c.customer_name,
      token,
      amount,
      currency: c.currency ?? 'EUR',
      allow_installments: allowInstallments,
      max_installments: Math.min(Math.max(Number(body?.max_installments ?? 12), 2), 24),
      expires_at: expires,
      created_by: user.id,
      status: 'open',
    }).select('id, token').single();
    if (insErr) throw new Error(insErr.message);

    const url = `${APP_URL}/zahlung/${token}`;
    let sent = false;
    const recipient = body?.to_email || c.customer_email;

    if (send && recipient && RESEND_API_KEY) {
      const res = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY') ?? ''}`,
          'X-Connection-Api-Key': RESEND_API_KEY,
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          from: FROM,
          to: [recipient],
          bcc: ['k.trinh@alix-operation.de'],
          subject: `Offener Betrag ${money(amount, c.currency ?? 'EUR')} – Ihr Zahlungslink`,
          html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
            <p>Sehr geehrte Damen und Herren,</p>
            <p>für Ihren offenen Betrag von <b>${money(amount, c.currency ?? 'EUR')}</b> haben wir Ihnen einen persönlichen Zugang eingerichtet.
            Dort sehen Sie alle offenen Posten${allowInstallments ? ' und können bei Bedarf eine Ratenzahlung beantragen' : ''}.</p>
            <p><a href="${url}" style="display:inline-block;padding:12px 22px;background:#B8952C;color:#fff;text-decoration:none;border-radius:6px">Offene Posten ansehen</a></p>
            <p style="font-size:12px;color:#666">Der Link ist bis zum ${new Date(expires).toLocaleDateString('de-DE')} gültig.</p>
            <p>Mit freundlichen Grüßen<br/>Alix Lasers ®<br/>Forderungsmanagement</p></div>`,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('resend error', res.status, err);
        return json({ error: `E-Mail-Versand fehlgeschlagen: ${err}`, url }, res.status);
      }
      sent = true;
      await admin.from('collect_payment_links').update({
        status: 'sent', note: `Versendet an ${recipient} am ${new Date().toLocaleString('de-DE')}`,
      }).eq('id', link.id);
    }

    await admin.from('collect_events').insert({
      case_id: caseId,
      event_type: sent ? 'payment_link_sent' : 'payment_link_created',
      channel: sent ? 'email' : 'portal',
      direction: sent ? 'outbound' : null,
      subject: sent ? `Zahlungslink an ${recipient} gesendet` : 'Zahlungslink erstellt',
      actor: user.id,
      meta: { link_id: link.id, amount, expires_at: expires },
    });

    return json({ success: true, url, token, expires_at: expires, sent });
  } catch (e: any) {
    console.error('collect-payment-link error', e);
    return json({ error: e?.message ?? 'Unbekannter Fehler' }, 500);
  }
});