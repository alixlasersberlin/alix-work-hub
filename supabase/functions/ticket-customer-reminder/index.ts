// Sendet automatische Erinnerungen an Kunden, die auf eine Antwort warten.
// Läuft per Cron (z. B. stündlich). Nach 2 Remindern → comm_status='customer_unreachable'.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_REMINDERS = 2;

function html(customerName: string, ticketNumber: string, subject: string) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#fff;color:#111;padding:24px">
    <h2 style="color:#0f172a">Erinnerung zu Ihrer Anfrage</h2>
    <p>Hallo ${customerName || ''},</p>
    <p>wir warten aktuell noch auf Ihre Rückmeldung zu <b>${subject || 'Ihrer Anfrage'}</b>.</p>
    <p>Bitte antworten Sie einfach auf diese E-Mail oder loggen Sie sich in unser Kundenportal ein.</p>
    ${ticketNumber ? `<p><b>Ticket:</b> ${ticketNumber}</p>` : ''}
    <p style="margin-top:24px;color:#64748b;font-size:12px">Diese Nachricht wurde automatisch von AlixWork erstellt.</p>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');

  try {
    const { data: due, error } = await supabase
      .from('tickets')
      .select('id, ticket_number, external_ticket_id, subject, title, customer_name, customer_email, customer_reminder_count, comm_status, ticket_department_id')
      .lte('next_customer_reminder_at', new Date().toISOString())
      .eq('comm_status', 'awaiting_customer')
      .not('customer_email', 'is', null)
      .limit(200);
    if (error) throw error;

    let sent = 0, unreachable = 0, skipped = 0;

    for (const t of due ?? []) {
      const count = (t.customer_reminder_count ?? 0) + 1;

      if (count > MAX_REMINDERS) {
        await supabase.from('tickets').update({
          comm_status: 'customer_unreachable',
          comm_status_since: new Date().toISOString(),
          next_customer_reminder_at: null,
        }).eq('id', t.id);
        await supabase.from('ticket_history').insert({
          ticket_id: t.id,
          action: 'auto_customer_unreachable',
          actor_label: 'System',
          details: { reminders_sent: t.customer_reminder_count },
        });
        unreachable++;
        continue;
      }

      const ticketNumber = t.ticket_number || t.external_ticket_id || '';
      const subject = t.subject || t.title || '';

      let ok = false;
      if (RESEND_KEY && t.customer_email) {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
          body: JSON.stringify({
            from: 'AlixWork Service <service@alix-finance.de>',
            to: [t.customer_email],
            subject: `Erinnerung: ${subject || ticketNumber}`,
            html: html(t.customer_name ?? '', ticketNumber, subject),
          }),
        });
        ok = r.ok;
        if (!r.ok) console.error('reminder send failed', await r.text());
      } else {
        skipped++;
      }

      // Get reminder_after_days for department
      let reminderDays = 3;
      if (t.ticket_department_id) {
        const { data: dept } = await supabase
          .from('ticket_departments')
          .select('reminder_after_days')
          .eq('id', t.ticket_department_id)
          .maybeSingle();
        if (dept?.reminder_after_days) reminderDays = dept.reminder_after_days;
      }

      const nextAt = new Date(Date.now() + reminderDays * 24 * 60 * 60 * 1000).toISOString();

      await supabase.from('tickets').update({
        customer_reminder_count: count,
        next_customer_reminder_at: nextAt,
      }).eq('id', t.id);

      await supabase.from('ticket_history').insert({
        ticket_id: t.id,
        action: 'customer_reminder_sent',
        actor_label: 'System',
        details: { count, sent: ok, email: t.customer_email },
      });

      if (ok) sent++;
    }

    return new Response(JSON.stringify({ ok: true, processed: due?.length ?? 0, sent, unreachable, skipped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('ticket-customer-reminder error', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
