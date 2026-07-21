// Predictive Engagement Engine — best-time-to-contact, response probability, churn risk.
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
      sb.from('ac_messages').select('channel, direction, created_at').eq('contact_id', contact_id).order('created_at', { ascending: false }).limit(50),
      sb.from('ac_calls').select('direction, duration_sec, created_at').eq('contact_id', contact_id).order('created_at', { ascending: false }).limit(25),
    ]);
    if (!contact) throw new Error('contact not found');

    const key = Deno.env.get('LOVABLE_API_KEY')!;
    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Du bist Predictive-Engagement-Engine. Antworte NUR mit JSON: {"best_time_to_contact":{"weekday":"Mo"|"Di"|"Mi"|"Do"|"Fr"|"Sa"|"So","hour_range":string,"timezone":"Europe/Berlin"},"response_probability":number(0-1),"churn_risk":number(0-1),"risk_level":"low"|"medium"|"high","recommended_channels":[string],"proactive_outreach":{"trigger":string,"message_hint":string},"reasoning":string,"confidence":number}' },
          { role: 'user', content: `Kontakt: ${JSON.stringify(contact)}\nMsgs: ${JSON.stringify((msgs ?? []).slice(0, 15))}\nCalls: ${JSON.stringify((calls ?? []).slice(0, 10))}` },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (r.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const p = (() => { try { return JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { return {}; } })();

    await sb.from('ac_predictions').insert({
      contact_id,
      kind: 'predictive_engagement',
      score: Number(p.response_probability ?? 0),
      risk_level: p.risk_level ?? (Number(p.churn_risk ?? 0) >= 0.6 ? 'high' : Number(p.churn_risk ?? 0) >= 0.3 ? 'medium' : 'low'),
      suggested_action: p.proactive_outreach?.trigger ?? null,
      payload: { ...p, model: 'google/gemini-3-flash-preview' },
    });

    return new Response(JSON.stringify({ success: true, ...p }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
