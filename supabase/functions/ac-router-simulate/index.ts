// Routing Simulator — trace which rule/agent WOULD be chosen without persisting a real decision.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Req = {
  name?: string;
  channel: 'call'|'chat'|'email'|'whatsapp'|'sms'|'ticket';
  language?: string;
  required_skills?: string[];
  customer_id?: string;
  customer_score?: number;
  priority_boost?: number;
  save?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const body = await req.json() as Req;
    if (!body.channel) {
      return new Response(JSON.stringify({ error: 'channel required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const sbUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await sbUser.auth.getUser();

    let score = body.customer_score ?? 0;
    if (!body.customer_score && body.customer_id) {
      const { data: s } = await sb.from('ac_customer_scores').select('score').eq('customer_id', body.customer_id).maybeSingle();
      if (s?.score != null) score = Number(s.score);
    }

    const { data: rules } = await sb.from('ac_routing_rules')
      .select('*').eq('is_active', true).in('channel', [body.channel, 'any'])
      .order('priority', { ascending: true });

    const trace: Array<{ rule_id: string; name: string; result: 'skip'|'match'; reason: string }> = [];
    let matched: any = null; let eligible: string[] = [];
    for (const r of rules ?? []) {
      if (r.min_customer_score != null && score < r.min_customer_score) { trace.push({ rule_id: r.id, name: r.name, result: 'skip', reason: `customer_score ${score} < ${r.min_customer_score}` }); continue; }
      if (r.required_language && body.language && r.required_language !== body.language) { trace.push({ rule_id: r.id, name: r.name, result: 'skip', reason: `language ${body.language} ≠ ${r.required_language}` }); continue; }
      const need = new Set([...(r.required_skills ?? []), ...(body.required_skills ?? [])]);
      let pool: string[] = r.target_user_ids ?? [];
      if (need.size > 0) {
        const { data: skilled } = await sb.from('ac_agent_skills')
          .select('user_id').in('skill', Array.from(need)).eq('is_available', true);
        const counts: Record<string, number> = {};
        (skilled ?? []).forEach((s: any) => { counts[s.user_id] = (counts[s.user_id] ?? 0) + 1; });
        pool = Object.entries(counts).filter(([, n]) => n >= need.size).map(([u]) => u);
        if (pool.length === 0) { trace.push({ rule_id: r.id, name: r.name, result: 'skip', reason: `no agent with skills ${Array.from(need).join(', ')}` }); continue; }
      }
      matched = r; eligible = pool;
      trace.push({ rule_id: r.id, name: r.name, result: 'match', reason: 'all criteria satisfied' });
      break;
    }

    let assigned: string | null = null;
    if (matched && eligible.length) {
      if (eligible.length === 1) assigned = eligible[0];
      else {
        const { data: busy } = await sb.from('ac_conversations')
          .select('assigned_to').in('assigned_to', eligible).in('status', ['open','pending']);
        const load: Record<string, number> = {};
        eligible.forEach((u) => { load[u] = 0; });
        (busy ?? []).forEach((c: any) => { if (c.assigned_to) load[c.assigned_to] = (load[c.assigned_to] ?? 0) + 1; });
        assigned = eligible.sort((a, b) => load[a] - load[b])[0];
      }
    }

    const result = {
      matched_rule_id: matched?.id ?? null,
      matched_rule_name: matched?.name ?? null,
      assigned_agent_id: assigned,
      eligible_agents: eligible,
      queue_id: matched?.target_queue_id ?? null,
      sla: matched ? { first_response_sec: matched.sla_first_response_sec, resolution_sec: matched.sla_resolution_sec } : null,
      fallback_used: !matched,
      customer_score: score,
      trace,
    };

    if (body.save) {
      await sb.from('ac_routing_simulations').insert({
        name: body.name ?? `Sim ${new Date().toISOString().slice(0,16)}`,
        input_payload: body as any,
        rules_snapshot: rules ?? [],
        result,
        matched_rule_id: matched?.id ?? null,
        assigned_agent_id: assigned,
        created_by: user?.id ?? null,
      });
    }

    return new Response(JSON.stringify({ ok: true, ...result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
