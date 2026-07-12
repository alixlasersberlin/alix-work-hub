// Cron: stündlich. Findet Tickets die > 24 h geschlossen sind und noch keine CSAT-Umfrage haben,
// legt Survey an und sendet Mail via send-transactional-email.
import { createClient } from 'npm:@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const SITE = 'https://alixwork.de';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(SUPABASE_URL, SERVICE);

  try {
    // Tickets, die vor > 24 h geschlossen wurden und noch keine CSAT-Umfrage haben
    const { data: candidates, error } = await sb
      .from('tickets')
      .select('id, ticket_number, subject, title, customer_email, customer_name, assigned_to, resolved_at')
      .in('status', ['gelöst', 'geschlossen', 'closed'])
      .not('customer_email', 'is', null)
      .lte('resolved_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .gte('resolved_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
      .limit(100);
    if (error) throw error;

    let sent = 0, skipped = 0;
    for (const t of candidates ?? []) {
      const { data: existing } = await sb.from('ticket_csat_surveys').select('id').eq('ticket_id', t.id).maybeSingle();
      if (existing) { skipped++; continue; }

      const { data: survey, error: insErr } = await sb.from('ticket_csat_surveys').insert({
        ticket_id: t.id,
        customer_email: t.customer_email,
        assigned_to: t.assigned_to,
      }).select('token').single();
      if (insErr || !survey) { skipped++; continue; }

      const csatUrl = `${SITE}/csat/${survey.token}`;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE}`, apikey: SERVICE },
        body: JSON.stringify({
          templateName: 'ticket-csat',
          recipientEmail: t.customer_email,
          idempotencyKey: `csat-${t.id}`,
          templateData: {
            customerName: t.customer_name ?? '',
            ticketNumber: t.ticket_number ?? '',
            subject: t.subject ?? t.title ?? '',
            csatUrl,
          },
        }),
      });
      if (resp.ok) sent++; else skipped++;
    }

    return new Response(JSON.stringify({ ok: true, sent, skipped, checked: candidates?.length ?? 0 }),
      { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
