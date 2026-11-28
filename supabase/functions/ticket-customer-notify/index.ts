import "../_shared/global-bcc.ts";
// Sendet Kundenmails für Service-Events. Loggt in service_communication_log.
// Events: ticket_received, ticket_in_progress, spare_part_ordered, repair_completed, shipment_sent
import { createClient } from 'npm:@supabase/supabase-js@2';
import { machineAuthorized } from '../_shared/job-auth.ts';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { escapeHtml, isUuid, storedRecipient } from '../_shared/security-core.ts';

const STAFF_ROLES = ['Super Admin', 'Admin', 'Order', 'SACHBEARBEITUNG', 'Reparaturannahme', 'Österreich', 'Tourenplanung', 'Finance'];

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
    <p>Hallo ${escapeHtml(ctx.customer_name)},</p>
    <p style="white-space:pre-line">${ctx.message ? escapeHtml(ctx.message) : 'Wir möchten Sie über den aktuellen Stand Ihres Anliegens informieren.'}</p>
    ${ctx.ticket_number ? `<p><b>Ticket:</b> ${escapeHtml(ctx.ticket_number)}</p>` : ''}
    ${ctx.repair_number ? `<p><b>Reparatur:</b> ${escapeHtml(ctx.repair_number)}</p>` : ''}
    <p style="margin-top:24px;color:#64748b;font-size:12px">Diese Nachricht wurde automatisch von AlixWork erstellt.</p>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  const deny = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const isMachine = machineAuthorized(req, Deno.env.get('CRON_SECRET') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    let callerClient: any = null;
    if (!isMachine) {
      const access = await requireCallerAccess(req, corsHeaders, STAFF_ROLES);
      if ('response' in access) return access.response;
      callerClient = access.caller;
    }
    const body = await req.json().catch(() => null);
    const { event, ticket_id, repair_order_id, recipient_email, customer_name, message, ticket_number, repair_number, device_maintenance_id } = body || {};
    if (typeof event !== 'string' || !/^[a-z_]{3,40}$/.test(event) || typeof recipient_email !== 'string' || recipient_email.length > 254) {
      return deny(400, 'event and recipient_email required');
    }
    if ((message != null && String(message).length > 5000) || (customer_name != null && String(customer_name).length > 300)) return deny(400, 'input too long');
    if (!isMachine) {
      // Staff may only notify the customer address stored on a record they can already read (RLS).
      let stored: unknown[] = [];
      if (isUuid(device_maintenance_id)) {
        const { data } = await callerClient.from('device_maintenance').select('customer_email').eq('id', device_maintenance_id).maybeSingle();
        stored = [data?.customer_email];
      } else if (isUuid(ticket_id)) {
        const { data } = await callerClient.from('tickets').select('customer_email').eq('id', ticket_id).maybeSingle();
        stored = [data?.customer_email];
      }
      if (!storedRecipient(recipient_email, ...stored)) return deny(403, 'Empfänger entspricht nicht dem gespeicherten Kundenkontakt');
    }

    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
    let sendStatus = 'skipped';
    let sendError: string | null = null;

    if (RESEND_KEY) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
        body: JSON.stringify({
          from: "Alix Lasers ® <noreply@alixwork.de>",
          to: [recipient_email],
          bcc: [...([] as string[]).concat(['rde@alix-lasers.com'] as any), "service@alix-lasers.com"],
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
    console.error('ticket-customer-notify failed', e?.message);
    return deny(500, 'Interner Fehler');
  }
});