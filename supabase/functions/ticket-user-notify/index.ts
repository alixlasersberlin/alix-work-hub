// Sendet Team-User-E-Mails bei Ticket-Ereignissen (Zuweisung, Erwähnung, neue Kundennachricht, SLA-Breach).
// Wird von DB-Trigger auf ticket_notifications INSERT via pg_net aufgerufen.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KIND_LABEL: Record<string, string> = {
  assigned: 'Ticket zugewiesen',
  mention: 'Sie wurden erwähnt',
  new_customer_message: 'Neue Kundennachricht',
  sla_breach: 'SLA überschritten',
  sla_warning: 'SLA-Warnung',
  handover: 'Ticket übergeben',
  escalation: 'Ticket eskaliert',
};

const APP_URL = Deno.env.get('APP_URL') || 'https://alix-finance.de';

function htmlFor(kind: string, ctx: any) {
  const heading = KIND_LABEL[kind] || 'Ticket-Benachrichtigung';
  const link = `${APP_URL}/tickets/${ctx.ticket_id}`;
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:12px;padding:24px">
      <div style="display:inline-block;background:#f59e0b;color:#000;font-weight:700;font-size:11px;letter-spacing:.06em;padding:4px 10px;border-radius:999px">${heading.toUpperCase()}</div>
      <h2 style="margin:16px 0 8px;color:#fff">${ctx.title || heading}</h2>
      ${ctx.message ? `<p style="color:#cbd5e1;margin:8px 0 16px">${String(ctx.message).replace(/</g,'&lt;')}</p>` : ''}
      ${ctx.ticket_title ? `<p style="color:#94a3b8;font-size:13px;margin:0 0 4px"><b>Ticket:</b> ${ctx.ticket_title}</p>` : ''}
      ${ctx.actor_name ? `<p style="color:#94a3b8;font-size:13px;margin:0 0 4px"><b>Von:</b> ${ctx.actor_name}</p>` : ''}
      <a href="${link}" style="display:inline-block;margin-top:16px;background:linear-gradient(90deg,#f59e0b,#d97706);color:#000;font-weight:600;padding:10px 18px;border-radius:8px;text-decoration:none">Ticket öffnen</a>
      <p style="margin-top:24px;color:#64748b;font-size:11px">AlixWork · Automatisch generierte Benachrichtigung</p>
    </div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { notification_id } = body || {};
    if (!notification_id) {
      return new Response(JSON.stringify({ error: 'notification_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: n, error: nErr } = await supabase
      .from('ticket_notifications')
      .select('id, user_id, ticket_id, kind, title, message, actor_name')
      .eq('id', notification_id)
      .maybeSingle();
    if (nErr || !n) {
      return new Response(JSON.stringify({ error: nErr?.message || 'notification not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Nur relevante Kinds per E-Mail schicken
    const EMAIL_KINDS = ['assigned', 'mention', 'new_customer_message', 'sla_breach', 'handover', 'escalation'];
    if (!EMAIL_KINDS.includes(n.kind)) {
      return new Response(JSON.stringify({ skipped: 'kind not emailable', kind: n.kind }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email, full_name, is_active')
      .eq('id', n.user_id)
      .maybeSingle();

    if (!profile?.email || profile.is_active === false) {
      return new Response(JSON.stringify({ skipped: 'no active user email' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: ticket } = await supabase
      .from('tickets')
      .select('title, external_ticket_id')
      .eq('id', n.ticket_id)
      .maybeSingle();

    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_KEY) {
      return new Response(JSON.stringify({ skipped: 'no RESEND_API_KEY' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const subject = `[AlixWork] ${KIND_LABEL[n.kind] || 'Ticket'}: ${ticket?.title || ticket?.external_ticket_id || ''}`.trim();
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: 'AlixWork <no-reply@alix-finance.de>',
        to: [profile.email],
        subject,
        html: htmlFor(n.kind, {
          title: n.title,
          message: n.message,
          actor_name: n.actor_name,
          ticket_id: n.ticket_id,
          ticket_title: ticket?.title || ticket?.external_ticket_id,
        }),
      }),
    });

    const ok = r.ok;
    const errText = ok ? null : await r.text();

    return new Response(JSON.stringify({ ok, error: errText, to: profile.email, kind: n.kind }), {
      status: ok ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
