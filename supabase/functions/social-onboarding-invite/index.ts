// Generates a signed onboarding link for a social_clients record and emails it
// to the customer. Auth-required: only signed-in staff can invite.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function jr(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function randomToken(len = 40) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return jr({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return jr({ error: 'Unauthorized' }, 401);

    const { client_id, recipient_email, base_url } = await req.json().catch(() => ({}));
    if (!client_id) return jr({ error: 'client_id required' }, 400);

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: canAdmin } = await userClient.rpc('can_manage_social');
    if (!canAdmin) {
      const { data: canAdmin2 } = await userClient.rpc('can_admin_social');
      if (!canAdmin2) return jr({ error: 'Forbidden' }, 403);
    }

    const { data: client, error: cErr } = await svc
      .from('social_clients')
      .select('id, company_name, contact_person, email, onboarding_token, onboarding_token_expires_at')
      .eq('id', client_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (cErr || !client) return jr({ error: 'Client not found' }, 404);

    const to = (recipient_email || client.email || '').trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return jr({ error: 'Keine gültige Empfänger-Email hinterlegt' }, 400);
    }

    // Reuse existing token if still valid > 3 days, else rotate.
    let token = client.onboarding_token;
    const expIso = client.onboarding_token_expires_at
      ? new Date(client.onboarding_token_expires_at).getTime()
      : 0;
    const now = Date.now();
    const THREE_DAYS = 3 * 24 * 3600 * 1000;
    if (!token || expIso - now < THREE_DAYS) {
      token = randomToken(40);
      const newExp = new Date(now + 30 * 24 * 3600 * 1000).toISOString();
      const { error: upErr } = await svc
        .from('social_clients')
        .update({ onboarding_token: token, onboarding_token_expires_at: newExp })
        .eq('id', client_id);
      if (upErr) return jr({ error: upErr.message }, 500);
    }

    const origin = (base_url && String(base_url).replace(/\/+$/, '')) || 'https://alixwork.de';
    const link = `${origin}/social-onboarding/${token}`;

    const greeting = client.contact_person ? `Hallo ${client.contact_person},` : 'Hallo,';
    const html = `
      <div style="font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0b0b0b;">
        <h2 style="margin:0 0 12px 0;">Social-Media Onboarding – ${client.company_name}</h2>
        <p>${greeting}</p>
        <p>vielen Dank, dass wir Ihre Social-Media-Betreuung übernehmen dürfen.
        Damit wir sofort loslegen können, brauchen wir noch einige Angaben von Ihnen
        (Corporate Design, Plattform-Zugänge, Standorte usw.).</p>
        <p style="margin:24px 0;">
          <a href="${link}" style="background:#0b0b0b;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Angaben jetzt ergänzen
          </a>
        </p>
        <p style="color:#555;font-size:13px;">Der Link ist 30 Tage gültig und persönlich für Sie.
        Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>
        <span style="word-break:break-all;">${link}</span></p>
        <p style="margin-top:32px;">Herzliche Grüße<br>Ihr Alix Lasers Social-Team</p>
      </div>
    `;

    const { error: mailErr } = await userClient.functions.invoke('send-mail', {
      body: {
        to,
        subject: `Social-Media Onboarding – ${client.company_name}`,
        html,
        from: 'news@alixwork.de',
      },
    });
    if (mailErr) return jr({ error: `Mailversand fehlgeschlagen: ${mailErr.message}` }, 500);

    return jr({ ok: true, link, sent_to: to });
  } catch (e) {
    return jr({ error: String((e as Error).message ?? e) }, 500);
  }
});
