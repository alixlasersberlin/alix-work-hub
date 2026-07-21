import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * SLA Watchdog (Cron alle 10 Min).
 * Prüft offene Conversations gegen aktive ac_sla_policies.
 * Erzeugt Breaches (first_response, resolution) und benachrichtigt escalate_to.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const { data: policies } = await sb.from('ac_sla_policies').select('*').eq('is_active', true);
    if (!policies?.length) return json({ policies: 0, breaches: 0 });

    const nowMs = Date.now();
    let created = 0;
    const { data: convs } = await sb.from('ac_conversations')
      .select('id,channel_type,priority,status,closed_at,created_at')
      .neq('status', 'closed')
      .limit(500);

    for (const c of convs ?? []) {
      const policy = policies.find((p: any) =>
        (!p.channel || p.channel === (c as any).channel_type) &&
        (!p.priority || p.priority === (c as any).priority)
      );
      if (!policy) continue;
      const createdMs = new Date((c as any).created_at).getTime();
      const ageMin = (nowMs - createdMs) / 60000;

      // first_response breach: check first outbound message
      if (ageMin > policy.first_response_min) {
        const { count } = await sb.from('ac_messages').select('id', { count: 'exact', head: true })
          .eq('conversation_id', (c as any).id).eq('direction', 'outbound');
        if (!count || count === 0) {
          const { data: exists } = await sb.from('ac_sla_breaches').select('id')
            .eq('conversation_id', (c as any).id).eq('breach_type', 'first_response')
            .is('resolved_at', null).limit(1);
          if (!exists?.length) {
            await sb.from('ac_sla_breaches').insert({
              policy_id: policy.id, conversation_id: (c as any).id,
              breach_type: 'first_response', meta: { age_min: Math.round(ageMin) },
            });
            created++;
            if (policy.escalate_to) {
              await sb.from('app_notifications').insert({
                user_id: policy.escalate_to, kind: 'sla_breach', severity: 'warning',
                title: 'SLA-Verstoß: First Response',
                message: `Konversation ${(c as any).id.slice(0, 8)} überfällig (${Math.round(ageMin)} Min)`,
                link: `/connect/inbox?c=${(c as any).id}`,
              });
            }
          }
        }
      }
      // resolution breach
      if (!(c as any).closed_at && ageMin > policy.resolution_min) {
        const { data: exists } = await sb.from('ac_sla_breaches').select('id')
          .eq('conversation_id', (c as any).id).eq('breach_type', 'resolution')
          .is('resolved_at', null).limit(1);
        if (!exists?.length) {
          await sb.from('ac_sla_breaches').insert({
            policy_id: policy.id, conversation_id: (c as any).id,
            breach_type: 'resolution', meta: { age_min: Math.round(ageMin) },
          });
          created++;
        }
      }
    }
    return json({ policies: policies.length, scanned: convs?.length ?? 0, breaches: created });
  } catch (e: any) {
    return json({ error: e?.message ?? 'internal' }, 500);
  }
});
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
