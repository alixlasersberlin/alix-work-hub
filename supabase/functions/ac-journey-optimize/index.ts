// Customer Journey AI-Optimizer — analyzes drop-offs and suggests
// next-best-step or A/B variants for a given journey.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { journey_id } = await req.json();
    if (!journey_id) throw new Error('journey_id required');

    const [{ data: journey }, { data: steps }, { data: runs }] = await Promise.all([
      sb.from('ac_journeys').select('*').eq('id', journey_id).single(),
      sb.from('ac_journey_steps').select('*').eq('journey_id', journey_id).order('step_order', { ascending: true }),
      sb.from('ac_journey_runs').select('current_step, status').eq('journey_id', journey_id).limit(5000),
    ]);
    if (!journey) throw new Error('journey not found');

    const byStep = new Map<any, { total: number; completed: number; failed: number }>();
    for (const r of runs ?? []) {
      const k = r.current_step ?? 0;
      const b = byStep.get(k) ?? { total: 0, completed: 0, failed: 0 };
      b.total += 1;
      if (r.status === 'completed') b.completed += 1;
      if (r.status === 'failed') b.failed += 1;
      byStep.set(k, b);
    }
    const analytics = [...byStep.entries()].map(([step, b]) => ({ step, ...b, drop_rate: b.total ? (b.failed / b.total) : 0 }));
    const worst = [...analytics].sort((a, b) => b.drop_rate - a.drop_rate)[0] ?? null;

    const key = Deno.env.get('LOVABLE_API_KEY');
    let recommendation = 'Nicht genug Daten für Empfehlung.';
    if (key) {
      const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'Du bist Customer-Journey-Optimizer. Gib eine kurze, umsetzbare deutsche Empfehlung (max. 6 Bulletpoints) inkl. konkreter A/B-Variante für den größten Drop-off.' },
            { role: 'user', content: `Journey: ${journey.name}\nSchritte: ${JSON.stringify(steps ?? [])}\nAnalytics: ${JSON.stringify(analytics)}\nWorst-Step: ${JSON.stringify(worst)}` },
          ],
        }),
      });
      if (r.ok) { const j = await r.json(); recommendation = j?.choices?.[0]?.message?.content ?? recommendation; }
    }

    return new Response(JSON.stringify({
      success: true, journey_id, analytics, worst_step: worst, recommendation,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
