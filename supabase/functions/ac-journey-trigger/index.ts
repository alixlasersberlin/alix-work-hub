import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireProcessAccess } from '../_shared/process-access.ts';
import { automationContact } from '../_shared/automation-contact.ts';
import { z } from 'npm:zod@3.25.76';

/**
 * POST { event_type, contact_id, payload? }
 * Startet neue Journey-Runs für alle aktiven Journeys mit passendem trigger_event.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const access = await requireProcessAccess(req, corsHeaders, ['Super Admin', 'Admin']);
    if ('response' in access) return access.response;
    const sb = access.client;
    const parsed = z.object({ event_type: z.string().trim().min(1).max(100), contact_id: z.string().uuid(), payload: z.record(z.unknown()).optional() }).strict().safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Invalid journey event' }, 400);
    const { event_type, contact_id, payload } = parsed.data;
    try { await automationContact(sb, contact_id, access.machine ? null : access.tenantIds); }
    catch { return json({ error: 'Contact not found in authorized scope' }, 404); }

    const { data: journeys, error: journeyError } = await sb.from('ac_journeys')
      .select('id,trigger_filter').eq('status', 'active').eq('trigger_event', event_type);
    if (journeyError) throw journeyError;

    let started = 0;
    for (const j of journeys ?? []) {
      // Optionaler Filter: bereits laufende Runs des Kontakts verhindern
      const { data: existing, error: existingError } = await sb.from('ac_journey_runs')
        .select('id').eq('journey_id', j.id).eq('contact_id', contact_id).eq('status', 'active').limit(1);
      if (existingError) throw existingError;
      if (existing && existing.length > 0) continue;

      const { error: writeError } = await sb.from('ac_journey_runs').insert({
        journey_id: j.id, contact_id,
        current_step: 0, status: 'active',
        next_action_at: new Date().toISOString(),
        context: { trigger_payload: payload ?? {} },
      });
      if (writeError) throw writeError;
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
