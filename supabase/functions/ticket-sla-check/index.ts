// SLA-Check für Tickets. Setzt sla_status (ok|warn_response|warn_progress|breach)
// und schreibt eine interne Nachricht an Serviceleitung + zugewiesene Techniker.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const closed = ['geschlossen', 'closed', 'gelöst'];
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('id,status,assigned_to,created_at,updated_at,sla_status,title')
    .not('status', 'in', `(${closed.map((s) => `"${s}"`).join(',')})`)
    .limit(2000);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const now = Date.now();
  let updated = 0;
  for (const t of tickets || []) {
    const ageH = (now - new Date(t.created_at).getTime()) / 3600000;
    const sinceUpdateH = (now - new Date(t.updated_at).getTime()) / 3600000;
    let status: string = 'ok';
    if (ageH > 24 * 7) status = 'breach';
    else if (ageH > 72) status = 'warn_progress';
    else if (sinceUpdateH > 24 && !t.assigned_to) status = 'warn_response';

    if (status !== t.sla_status) {
      await supabase.from('tickets').update({ sla_status: status, sla_last_check: new Date().toISOString() }).eq('id', t.id);
      updated++;
      if (status !== 'ok') {
        await supabase.from('service_communication_log').insert({
          ticket_id: t.id,
          event_type: `sla_${status}`,
          status: 'logged',
          payload: { title: t.title, age_hours: Math.round(ageH) },
        });
      }
    }
  }

  return new Response(JSON.stringify({ checked: tickets?.length || 0, updated }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
