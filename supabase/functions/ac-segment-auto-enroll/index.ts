// Enrollt neue Segment-Mitglieder automatisch in die gekoppelte Journey (falls auto_enroll_journey_id gesetzt).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireProcessAccess } from '../_shared/process-access.ts';
import { z } from 'npm:zod@3.25.76';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const access = await requireProcessAccess(req, corsHeaders, ['Super Admin', 'Admin']);
    if ('response' in access) return access.response;
    const parsed = z.object({ dry_run: z.boolean().default(false) }).strict().safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return new Response(JSON.stringify({ error: 'Invalid enrollment request' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const sb = access.client;
    const { data: segs, error: segmentError } = await sb.from('ac_journey_segments')
      .select('id, name, criteria, auto_enroll_journey_id')
      .not('auto_enroll_journey_id', 'is', null);
    if (segmentError) throw segmentError;
    let enrolled = 0;
    for (const s of segs ?? []) {
      const { data: journey, error: journeyError } = await sb.from('ac_journeys').select('id,status').eq('id', s.auto_enroll_journey_id).maybeSingle();
      if (journeyError) throw journeyError;
      if (!journey || journey.status !== 'active') continue;
      const minTouch = Number((s.criteria as any)?.min_touchpoints ?? 1);
      // Kandidaten: Kontakte mit >= minTouch Konversationen, noch nicht in dieser Journey
      let contactsQuery = sb.from('ac_contacts').select('id,tenant_id').limit(500);
      if (!access.machine) contactsQuery = contactsQuery.in('tenant_id', access.tenantIds);
      const { data: contacts, error: contactError } = await contactsQuery;
      if (contactError) throw contactError;
      for (const c of contacts ?? []) {
        if (!access.machine && !access.tenantIds.includes(c.tenant_id)) continue;
        const { count, error: countError } = await sb.from('ac_conversations').select('id', { count: 'exact', head: true }).eq('contact_id', c.id).eq('tenant_id', c.tenant_id);
        if (countError) throw countError;
        if ((count ?? 0) < minTouch) continue;
        const { data: existing, error: existingError } = await sb.from('ac_journey_runs').select('id')
          .eq('journey_id', s.auto_enroll_journey_id).eq('contact_id', c.id).limit(1);
        if (existingError) throw existingError;
        if (existing?.length) continue;
        if (parsed.data.dry_run) { enrolled++; continue; }
        const { error: writeError } = await sb.from('ac_journey_runs').insert({
          journey_id: s.auto_enroll_journey_id,
          contact_id: c.id,
          status: 'active',
          current_step: 0,
          trigger_meta: { segment_id: s.id, auto_enroll: true },
        });
        if (writeError) throw writeError;
        enrolled++;
      }
    }
    return new Response(JSON.stringify({ ok: true, segments: segs?.length ?? 0, enrolled, dry_run: parsed.data.dry_run }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
