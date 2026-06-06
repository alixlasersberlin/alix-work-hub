// Sendet Kundenmails für Service-Events. Loggt in service_communication_log.
// Events: ticket_received, ticket_in_progress, spare_part_ordered, repair_completed, shipment_sent
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUBJECTS: Record<string, string> = {
  ticket_received: 'Ihr Serviceticket ist bei uns eingegangen',
  ticket_in_progress: 'Ihr Serviceticket ist in Bearbeitung',
  spare_part_ordered: 'Ersatzteil für Ihre Reparatur bestellt',
  repair_completed: 'Ihre Reparatur ist abgeschlossen',
  shipment_sent: 'Ihre Sendung wurde versendet',
};

function htmlFor(event: string, ctx: any) {
  const heading = SUBJECTS[event] || 'Service-Update';
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#fff;color:#111;padding:24px">
    <h2 style="color:#0f172a">${heading}</h2>
    <p>Hallo ${ctx.customer_name || ''},</p>
    <p>${ctx.message || 'Wir möchten Sie über den aktuellen Stand Ihres Anliegens informieren.'}</p>
    ${ctx.ticket_number ? `<p><b>Ticket:</b> ${ctx.ticket_number}</p>` : ''}
    ${ctx.repair_number ? `<p><b>Reparatur:</b> ${ctx.repair_number}</p>` : ''}
    <p style="margin-top:24px;color:#64748b;font-size:12px">Diese Nachricht wurde automatisch von AlixWork erstellt.</p>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { event, ticket_id, repair_order_id, recipient_email, customer_name, message, ticket_number, repair_number } = body || {};
    if (!event || !recipient_email) {
      return new Response(JSON.stringify({ error: 'event and recipient_email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
    let sendStatus = 'skipped';
    let sendError: string | null = null;

    if (RESEND_KEY) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
        body: JSON.stringify({
          from: 'AlixWork Service <service@alix-finance.de>',
          to: [recipient_email],
          subject: SUBJECTS[event] || 'Service-Update',
          html: htmlFor(event, { customer_name, message, ticket_number, repair_number }),
        }),
      });
      sendStatus = r.ok ? 'sent' : 'failed';
      if (!r.ok) sendError = await r.text();
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await supabase.from('service_communication_log').insert({
      ticket_id: ticket_id || null,
      repair_order_id: repair_order_id || null,
      event_type: event,
      recipient_email,
      status: sendStatus,
      payload: { customer_name, message, ticket_number, repair_number, error: sendError },
    });

    return new Response(JSON.stringify({ ok: true, status: sendStatus }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
