// Enrollt neue Segment-Mitglieder automatisch in die gekoppelte Journey (falls auto_enroll_journey_id gesetzt).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireProcessAccess } from '../_shared/process-access.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const access = await requireProcessAccess(req, corsHeaders, ['Super Admin', 'Admin']);
    if ('response' in access) return access.response;
    const sb = access.client;
    const { data: segs } = await sb.from('ac_journey_segments')
      .select('id, name, criteria, auto_enroll_journey_id')
      .not('auto_enroll_journey_id', 'is', null);
    let enrolled = 0;
    for (const s of segs ?? []) {
      const minTouch = Number((s.criteria as any)?.min_touchpoints ?? 1);
      // Kandidaten: Kontakte mit >= minTouch Konversationen, noch nicht in dieser Journey
      const { data: contacts } = await sb.from('ac_contacts').select('id').limit(500);
      for (const c of contacts ?? []) {
        const { count } = await sb.from('ac_conversations').select('id', { count: 'exact', head: true }).eq('contact_id', c.id);
        if ((count ?? 0) < minTouch) continue;
        const { data: existing } = await sb.from('ac_journey_runs').select('id')
          .eq('journey_id', s.auto_enroll_journey_id).eq('contact_id', c.id).limit(1);
        if (existing?.length) continue;
        await sb.from('ac_journey_runs').insert({
          journey_id: s.auto_enroll_journey_id,
          contact_id: c.id,
          status: 'active',
          current_step: 0,
          trigger_meta: { segment_id: s.id, auto_enroll: true },
        });
        enrolled++;
      }
    }
    return new Response(JSON.stringify({ ok: true, segments: segs?.length ?? 0, enrolled }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
