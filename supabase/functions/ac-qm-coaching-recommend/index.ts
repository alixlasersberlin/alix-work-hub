import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { agent_user_id } = await req.json();
    if (!agent_user_id) throw new Error('agent_user_id required');

    const { data: evals } = await supabase.from('ac_qm_evaluations')
      .select('percent, scores, notes, created_at').eq('agent_user_id', agent_user_id)
      .order('created_at', { ascending: false }).limit(20);

    const summary = (evals ?? []).map(e => `Score ${Number(e.percent).toFixed(0)}% | ${e.notes ?? ''}`).join('\n');

    let recommendation = 'Fokus auf Konsistenz. Mehr Stichproben nötig.';
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (key && summary) {
      const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'Du bist QM-Coach im Customer Service. Erstelle eine kurze, konkrete Coaching-Empfehlung (max. 6 Bulletpoints, deutsch) basierend auf den QM-Bewertungen.' },
            { role: 'user', content: summary },
          ],
        }),
      });
      if (r.ok) { const j = await r.json(); recommendation = j?.choices?.[0]?.message?.content ?? recommendation; }
    }

    const { data: session, error } = await supabase.from('ac_qm_coaching_sessions').insert({
      agent_user_id, status: 'scheduled', coach_notes: recommendation,
      focus_areas: ['ai_generated'],
    }).select().single();
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, session_id: session.id, recommendation }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
