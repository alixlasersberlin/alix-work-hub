// Public Endpoint: zeigt KV-Daten an / nimmt Annahme oder Ablehnung entgegen.
// Eingabe: { token, action: 'view' | 'accept' | 'reject', email?, note? }
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const token = String(body.token || '');
    const action = String(body.action || 'view');
    if (!token) return new Response(JSON.stringify({ error: 'token required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: q } = await sb.from('repair_quotes').select('*').eq('approval_token', token).maybeSingle();
    if (!q) return new Response(JSON.stringify({ error: 'Kostenvoranschlag nicht gefunden oder Link ungültig.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: r } = await sb.from('repair_orders').select('id, repair_number, customer_name, customer_email, device_brand, device_model, device_serial_number').eq('id', q.repair_order_id).maybeSingle();
    const { data: items } = await sb.from('repair_quote_items').select('*').eq('quote_id', q.id).order('sort_order').order('created_at');

    if (action === 'view') {
      return new Response(JSON.stringify({ quote: q, repair: r, items }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action !== 'accept' && action !== 'reject') {
      return new Response(JSON.stringify({ error: 'invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (q.status !== 'Versendet') {
      return new Response(JSON.stringify({ error: `Bereits entschieden (${q.status}).` }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const email = String(body.email || '').trim();
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Ungültige E-Mail-Adresse' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const newStatus = action === 'accept' ? 'Freigegeben' : 'Abgelehnt';
    await sb.from('repair_quotes').update({
      status: newStatus,
      decided_at: new Date().toISOString(),
      decided_by_email: email,
    }).eq('id', q.id);
    await sb.from('repair_quote_history').insert({
      quote_id: q.id,
      action: action === 'accept' ? 'customer_accepted' : 'customer_rejected',
      actor_email: email,
      meta: { note: body.note || null },
    });

    // Benachrichtigung an Service
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
          body: JSON.stringify({
            from: 'AlixWork <service@alix-finance.de>',
            to: ['service@alix-lasers.com'],
            subject: `KV ${q.quote_number} ${newStatus} – ${r?.repair_number || ''}`,
            html: `<p>Kunde <b>${email}</b> hat den Kostenvoranschlag <b>${q.quote_number}</b> (Reparatur ${r?.repair_number}) <b>${newStatus}</b>.</p>${body.note ? `<p>Anmerkung:<br>${String(body.note).replace(/</g, '&lt;')}</p>` : ''}`,
          }),
        });
      } catch {/* ignore */}
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
