// Customer Intelligence Hub — predictive churn, CLV score, next-best-offer per contact.
// Persists into ac_predictions and updates ac_customer_health.
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
      sb.from('ac_messages').select('sender_type, created_at, body').eq('contact_id', contact_id).order('created_at', { ascending: false }).limit(50),
      sb.from('ac_calls').select('direction, sentiment, sentiment_score, duration_sec, created_at').eq('contact_id', contact_id).order('created_at', { ascending: false }).limit(30),
    ]);
    if (!contact) throw new Error('contact not found');

    const key = Deno.env.get('LOVABLE_API_KEY')!;
    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Du bist Customer-Intelligence-Analyst. Antworte NUR mit JSON: {"churn_risk":number(0-1),"clv_score":number(0-100),"segment":string,"next_best_offer":string,"cross_sell":[string],"reasoning":string,"auto_tags":[string]}' },
          { role: 'user', content: `Kontakt: ${JSON.stringify(contact)}\nRecent Messages (${msgs?.length ?? 0}): ${JSON.stringify((msgs ?? []).slice(0, 10))}\nRecent Calls (${calls?.length ?? 0}): ${JSON.stringify((calls ?? []).slice(0, 10))}` },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (r.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const p = (() => { try { return JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { return {}; } })();

    const churn = Number(p.churn_risk ?? 0);
    const clv = Number(p.clv_score ?? 0);

    await sb.from('ac_predictions').insert({
      contact_id,
      kind: 'customer_intelligence',
      score: churn,
      risk_level: churn >= 0.7 ? 'high' : churn >= 0.4 ? 'medium' : 'low',
      suggested_action: p.next_best_offer ?? null,
      payload: { clv_score: clv, segment: p.segment, next_best_offer: p.next_best_offer, cross_sell: p.cross_sell, reasoning: p.reasoning, auto_tags: p.auto_tags, model: 'google/gemini-3-flash-preview' },
    });

    if (health) {
      await sb.from('ac_customer_health').update({
        churn_risk: churn,
        health_score: Math.round((1 - churn) * 100),
        updated_at: new Date().toISOString(),
      }).eq('contact_id', contact_id);
    }

    return new Response(JSON.stringify({ success: true, ...p }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
