// Omnichannel Router — picks the best rule + agent for an incoming interaction.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RouteReq = {
  channel: 'call'|'chat'|'email'|'whatsapp'|'sms'|'ticket';
  source_id?: string;
  source_type?: string;
  language?: string;
  required_skills?: string[];
  customer_id?: string;
  customer_score?: number;
  priority_boost?: number;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json() as RouteReq;
    if (!body.channel) return new Response(JSON.stringify({ error: 'channel required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Fetch score if not provided
    let score = body.customer_score ?? 0;
    if (!body.customer_score && body.customer_id) {
      const { data: s } = await sb.from('ac_customer_scores').select('score').eq('customer_id', body.customer_id).maybeSingle();
      if (s?.score != null) score = Number(s.score);
    }

    // Active rules matching this channel, ordered by priority (lower = higher pri)
    const { data: rules } = await sb.from('ac_routing_rules')
      .select('*').eq('is_active', true).in('channel', [body.channel, 'any'])
      .order('priority', { ascending: true });

    let chosen: any = null;
    let reason = '';
    for (const r of rules ?? []) {
      if (r.min_customer_score != null && score < r.min_customer_score) continue;
      if (r.required_language && body.language && r.required_language !== body.language) continue;
      const need = new Set([...(r.required_skills ?? []), ...(body.required_skills ?? [])]);
      if (need.size > 0) {
        // ensure at least one available agent has all needed skills
        const { data: skilled } = await sb.from('ac_agent_skills')
          .select('user_id').in('skill', Array.from(need)).eq('is_available', true);
        const counts: Record<string, number> = {};
        (skilled ?? []).forEach((s) => { counts[s.user_id] = (counts[s.user_id] ?? 0) + 1; });
        const eligible = Object.entries(counts).filter(([, n]) => n >= need.size).map(([u]) => u);
        if (eligible.length === 0) continue;
        chosen = { rule: r, agents: eligible };
      } else {
        chosen = { rule: r, agents: r.target_user_ids ?? [] };
      }
      reason = `matched rule "${r.name}"`;
      break;
    }

    // Pick single agent: least-busy heuristic (fewest open conversations)
    let chosenUserId: string | null = null;
    if (chosen) {
      const pool: string[] = chosen.agents;
      if (pool.length === 1) chosenUserId = pool[0];
      else if (pool.length > 1) {
        const { data: busy } = await sb.from('ac_conversations')
          .select('assigned_to').in('assigned_to', pool).in('status', ['open','pending']);
        const load: Record<string, number> = {};
        pool.forEach((u) => { load[u] = 0; });
        (busy ?? []).forEach((c: any) => { if (c.assigned_to) load[c.assigned_to] = (load[c.assigned_to] ?? 0) + 1; });
        chosenUserId = pool.sort((a, b) => load[a] - load[b])[0];
      }
    }

    const finalScore = (chosen?.rule?.boost_by_customer_score ? score : 0) - (chosen?.rule?.priority ?? 100) - (body.priority_boost ?? 0);

    const { data: decision } = await sb.from('ac_routing_decisions').insert({
      rule_id: chosen?.rule?.id ?? null,
      channel: body.channel,
      source_id: body.source_id ?? null,
      source_type: body.source_type ?? null,
      chosen_user_id: chosenUserId,
      chosen_queue_id: chosen?.rule?.target_queue_id ?? null,
      reason: chosen ? reason : 'no matching rule — default queue',
      score: finalScore,
      fallback_used: !chosen,
      metadata: { customer_score: score, required_skills: body.required_skills ?? [], language: body.language ?? null },
    }).select().single();

    return new Response(JSON.stringify({
      ok: true,
      rule_id: chosen?.rule?.id ?? null,
      user_id: chosenUserId,
      queue_id: chosen?.rule?.target_queue_id ?? null,
      sla: chosen?.rule ? { first_response_sec: chosen.rule.sla_first_response_sec, resolution_sec: chosen.rule.sla_resolution_sec } : null,
      overflow: chosen?.rule ? { after_sec: chosen.rule.overflow_after_sec, queue_id: chosen.rule.overflow_target_queue_id, user_ids: chosen.rule.overflow_target_user_ids } : null,
      decision_id: decision?.id,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
