// QM AI Auto-Score — scores a call transcript against an active scorecard.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AI_KEY = Deno.env.get('LOVABLE_API_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { call_id, scorecard_id } = await req.json();
    if (!call_id || !scorecard_id) return new Response(JSON.stringify({ error: 'call_id + scorecard_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const [{ data: call }, { data: sc }] = await Promise.all([
      sb.from('ac_calls').select('id, transcript, agent_user_id, summary, sentiment').eq('id', call_id).single(),
      sb.from('ac_qm_scorecards').select('*').eq('id', scorecard_id).single(),
    ]);
    if (!call?.transcript) throw new Error('call has no transcript — run ac-call-ai-process first');
    if (!sc) throw new Error('scorecard not found');

    const criteria = Array.isArray(sc.criteria) ? sc.criteria : [];
    if (criteria.length === 0) throw new Error('scorecard has no criteria');

    const rubric = criteria.map((c: any) => `- ${c.key} (${c.label}, max ${c.max_score ?? 5}, weight ${c.weight ?? 1}): ${c.description ?? ''}`).join('\n');

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${AI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: `Du bist QM-Auditor. Bewerte das Gesprächstranskript strikt nach folgenden Kriterien:\n${rubric}\n\nAntworte NUR mit gültigem JSON: {"scores": {"<key>": number}, "notes": string, "coaching_required": boolean}` },
          { role: 'user', content: (call.transcript as string).slice(0, 18000) },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!aiRes.ok) throw new Error(`AI ${aiRes.status}: ${await aiRes.text()}`);
    const j = await aiRes.json();
    const parsed = (() => { try { return JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { return {}; } })();

    let weighted = 0, maxPossible = 0;
    for (const c of criteria) {
      const s = Number(parsed.scores?.[c.key] ?? 0);
      const w = Number(c.weight ?? 1);
      const max = Number(c.max_score ?? 5);
      weighted += s * w;
      maxPossible += max * w;
    }
    const percent = maxPossible > 0 ? Number(((weighted / maxPossible) * 100).toFixed(1)) : 0;

    const coachingRequired = !!parsed.coaching_required || percent < 70;
    const { data: evalRow, error } = await sb.from('ac_qm_evaluations').insert({
      scorecard_id, call_id, agent_user_id: call.agent_user_id ?? null,
      scores: parsed.scores ?? {},
      weighted_total: weighted, max_possible: maxPossible, percent,
      notes: parsed.notes ?? null,
      ai_generated: true,
      status: 'completed',
      coaching_required: coachingRequired,
    }).select().single();
    if (error) throw error;

    // Auto-Coaching: bei 2 aufeinanderfolgenden schlechten Scores (<70) Session anlegen
    let coachingCreated = false;
    if (coachingRequired && call.agent_user_id) {
      const { data: recent } = await sb
        .from('ac_qm_evaluations')
        .select('percent, created_at')
        .eq('agent_user_id', call.agent_user_id)
        .order('created_at', { ascending: false })
        .limit(2);
      const bothBad = (recent ?? []).length >= 2 && recent!.every((r: any) => Number(r.percent) < 70);
      if (bothBad) {
        const { data: existing } = await sb
          .from('ac_qm_coaching_sessions')
          .select('id')
          .eq('agent_id', call.agent_user_id)
          .in('status', ['scheduled', 'in_progress'])
          .limit(1);
        if (!existing?.length) {
          await sb.from('ac_qm_coaching_sessions').insert({
            agent_id: call.agent_user_id,
            evaluation_id: evalRow.id,
            scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            duration_min: 30,
            topics: ['auto-generated'],
            improvements: parsed.notes ?? `Auto-Trigger: 2× Score < 70% (zuletzt ${percent}%)`,
            status: 'scheduled',
          });
          coachingCreated = true;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, evaluation: evalRow, percent, coaching_created: coachingCreated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
