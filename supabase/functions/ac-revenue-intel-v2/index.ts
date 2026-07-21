// Revenue Intelligence 2.0 — deal scoring, forecast, coaching insights, win/loss analysis.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { contact_id } = await req.json();
    if (!contact_id) throw new Error('contact_id required');

    const [{ data: contact }, { data: msgs }, { data: calls }] = await Promise.all([
      sb.from('ac_contacts').select('*').eq('id', contact_id).single(),
      sb.from('ac_messages').select('direction, body, channel, created_at').eq('contact_id', contact_id).order('created_at', { ascending: false }).limit(30),
      sb.from('ac_calls').select('direction, sentiment, sentiment_score, duration_sec, created_at').eq('contact_id', contact_id).order('created_at', { ascending: false }).limit(20),
    ]);
    if (!contact) throw new Error('contact not found');

    const key = Deno.env.get('LOVABLE_API_KEY')!;
    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Du bist Revenue-Intelligence-Analyst. Bewerte Deal-Wahrscheinlichkeit aus Konversationen. Antworte NUR mit JSON: {"deal_score":number(0-100),"win_probability":number(0-1),"forecast_stage":"lead"|"qualified"|"proposal"|"negotiation"|"closed","risk_factors":[string],"buying_signals":[string],"coaching_tips":[string],"win_loss_quotes":[string],"recommended_next_action":string}' },
          { role: 'user', content: `Kontakt: ${JSON.stringify(contact)}\nRecent Msgs: ${JSON.stringify((msgs ?? []).slice(0, 10))}\nRecent Calls: ${JSON.stringify((calls ?? []).slice(0, 10))}` },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (r.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const p = (() => { try { return JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { return {}; } })();
    const winProb = Number(p.win_probability ?? 0);

    await sb.from('ac_predictions').insert({
      contact_id,
      kind: 'revenue_intelligence_v2',
      score: winProb,
      risk_level: winProb >= 0.7 ? 'low' : winProb >= 0.4 ? 'medium' : 'high',
      suggested_action: p.recommended_next_action ?? null,
      payload: { ...p, model: 'google/gemini-3-flash-preview' },
    });

    return new Response(JSON.stringify({ success: true, ...p }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
