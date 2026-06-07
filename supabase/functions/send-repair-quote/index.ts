// Versendet einen Kostenvoranschlag per E-Mail an den Kunden.
// Erwartet: { quote_id } – verwendet repair_quotes + repair_orders.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { quote_id } = await req.json();
    if (!quote_id) return new Response(JSON.stringify({ error: 'quote_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: q } = await sb.from('repair_quotes').select('*').eq('id', quote_id).maybeSingle();
    if (!q) return new Response(JSON.stringify({ error: 'quote not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: r } = await sb.from('repair_orders').select('*').eq('id', q.repair_order_id).maybeSingle();
    if (!r?.customer_email) return new Response(JSON.stringify({ error: 'no customer email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const APP_URL = Deno.env.get('APP_URL') || 'https://alixwork.de';
    const approvalLink = `${APP_URL}/repair-quote/${q.approval_token}`;
    const totalGross = Number(q.total_gross || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111;padding:24px;background:#fff">
      <h2 style="color:#0f172a">Ihr Kostenvoranschlag ${q.quote_number}</h2>
      <p>Hallo ${r.customer_name || ''},</p>
      <p>vielen Dank, dass wir Ihr Gerät reparieren dürfen. Anbei unser Kostenvoranschlag.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 8px;color:#666">Reparatur-Nr.</td><td style="padding:4px 8px"><b>${r.repair_number}</b></td></tr>
        <tr><td style="padding:4px 8px;color:#666">KV-Nr.</td><td style="padding:4px 8px"><b>${q.quote_number}</b></td></tr>
        <tr><td style="padding:4px 8px;color:#666">Gesamtbetrag (brutto)</td><td style="padding:4px 8px;font-size:18px"><b>${totalGross} €</b></td></tr>
      </table>
      ${q.customer_note ? `<div style="background:#fffbea;border:1px solid #fde68a;padding:10px;margin:10px 0;border-radius:4px"><b>Hinweis:</b><br>${String(q.customer_note).replace(/</g, '&lt;')}</div>` : ''}
      <p style="margin-top:24px">Bitte bestätigen Sie den Kostenvoranschlag online:</p>
      <p><a href="${approvalLink}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600">Kostenvoranschlag ansehen &amp; entscheiden</a></p>
      <p style="margin-top:24px;color:#64748b;font-size:12px">Mit freundlichen Grüßen<br/>Ihr Alix Lasers Service-Team</p>
    </body></html>`;

    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
    let sendStatus: 'sent' | 'failed' | 'skipped' = 'skipped';
    let sendError: string | null = null;
    if (RESEND_KEY) {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
        body: JSON.stringify({
          from: 'AlixWork Service <service@alix-finance.de>',
          to: [r.customer_email],
          subject: `Kostenvoranschlag ${q.quote_number} – ${r.repair_number}`,
          html,
        }),
      });
      sendStatus = resp.ok ? 'sent' : 'failed';
      if (!resp.ok) sendError = await resp.text();
    }

    await sb.from('repair_quotes').update({ status: 'Versendet', sent_at: new Date().toISOString() }).eq('id', quote_id);
    await sb.from('repair_quote_history').insert({
      quote_id, action: 'sent', actor_email: r.customer_email, meta: { status: sendStatus, error: sendError, link: approvalLink },
    });

    return new Response(JSON.stringify({ ok: true, status: sendStatus, link: approvalLink }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
