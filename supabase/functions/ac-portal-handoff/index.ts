// Portal-Handoff: erzeugt Ticket aus einer Portal-Chat-Session und markiert Handoff als abgeschlossen.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { session_token, channel, subject, contact_email, contact_phone } = await req.json();
    if (!session_token) throw new Error('session_token required');

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: session } = await sb.from('ac_portal_chat_sessions').select('*').eq('session_token', session_token).maybeSingle();
    if (!session) throw new Error('session not found');

    const history = Array.isArray(session.messages) ? session.messages : [];
    const transcript = history.map((m: any) => `[${m.role}] ${m.content}`).join('\n');
    const email = contact_email || session.contact_email;

    // Ticket anlegen
    const { data: ticket, error: tErr } = await sb.from('tickets').insert({
      subject: subject || `Self-Service Anfrage (${channel ?? 'portal'})`,
      description: transcript.slice(0, 8000),
      status: 'open',
      priority: 'normal',
      source: 'portal',
      channel: channel ?? 'portal',
      requester_email: email ?? null,
      requester_phone: contact_phone ?? null,
    }).select('id').single();
    if (tErr) throw tErr;

    await sb.from('ac_portal_chat_sessions').update({
      ticket_id: ticket.id,
      handoff_status: 'completed',
      handoff_channel: channel ?? session.handoff_channel ?? 'portal',
      handoff_completed_at: new Date().toISOString(),
      handoff_requested: true,
    }).eq('session_token', session_token);

    return new Response(JSON.stringify({ ok: true, ticket_id: ticket.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
