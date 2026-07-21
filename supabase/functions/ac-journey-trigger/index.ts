import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * POST { event_type, contact_id, payload? }
 * Startet neue Journey-Runs für alle aktiven Journeys mit passendem trigger_event.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const { event_type, contact_id, payload } = await req.json();
    if (!event_type || !contact_id) return json({ error: 'event_type & contact_id required' }, 400);

    const { data: journeys } = await sb.from('ac_journeys')
      .select('id,trigger_filter').eq('status', 'active').eq('trigger_event', event_type);

    let started = 0;
    for (const j of journeys ?? []) {
      // Optionaler Filter: bereits laufende Runs des Kontakts verhindern
      const { data: existing } = await sb.from('ac_journey_runs')
        .select('id').eq('journey_id', j.id).eq('contact_id', contact_id).eq('status', 'active').limit(1);
      if (existing && existing.length > 0) continue;

      await sb.from('ac_journey_runs').insert({
        journey_id: j.id, contact_id,
        current_step: 0, status: 'active',
        next_action_at: new Date().toISOString(),
        context: { trigger_payload: payload ?? {} },
      });
      started++;
    }
    return json({ started, matched_journeys: journeys?.length ?? 0 });
  } catch (e: any) {
    return json({ error: e?.message ?? 'internal' }, 500);
  }
});
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
