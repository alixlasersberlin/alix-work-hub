import { requireCallerAccess } from '../_shared/caller-access.ts';
// Sentiment & Emotion AI 2.0 — realtime multi-emotion detection with escalation triggers.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  const access = await requireCallerAccess(req, corsHeaders);
  if ('response' in access) return access.response;
  try {
    const { text, channel = 'chat', contact_id, conversation_id, lang = 'auto' } = await req.json();
    if (!text) throw new Error('text required');
    if (typeof text !== 'string' || !text.trim() || text.length > 20000) return new Response(JSON.stringify({ error: 'Invalid text' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    for (const [table, id] of [['ac_contacts', contact_id], ['ac_conversations', conversation_id]] as const) {
      if (id == null) continue;
      if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return new Response(JSON.stringify({ error: 'Invalid identifier' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data, error } = await access.caller.from(table).select('id').eq('id', id).maybeSingle();
      if (error || !data) return new Response(JSON.stringify({ error: 'Record unavailable' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const key = Deno.env.get('LOVABLE_API_KEY')!;
    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Du analysierst Kundenkommunikation. Erkenne primäre Emotion und Sub-Emotionen. Antworte NUR mit JSON: {"sentiment":"positive|neutral|negative","score":number(-1..1),"primary_emotion":"joy|trust|anger|fear|sadness|disgust|surprise|anticipation|frustration|neutral","emotion_intensity":number(0..1),"secondary_emotions":[string],"escalation_recommended":boolean,"escalation_reason":string,"empathy_coaching":{"suggested_reply":string,"tone_advice":string,"do":[string],"dont":[string]},"compliance_flags":[string],"detected_lang":string,"confidence":number}' },
          { role: 'user', content: `Kanal: ${channel}\nSprache: ${lang}\n---\n${text}` },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (r.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const p = (() => { try { return JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { return {}; } })();

    if (contact_id || conversation_id) {
      const sb = access.caller;
      await sb.from('ac_predictions').insert({
        contact_id: contact_id ?? null,
        kind: 'sentiment_emotion',
        score: Number(p.score ?? 0),
        risk_level: p.escalation_recommended ? 'high' : (p.sentiment === 'negative' ? 'medium' : 'low'),
        suggested_action: p.empathy_coaching?.suggested_reply?.slice(0, 200) ?? null,
        payload: { conversation_id, channel, text: String(text).slice(0, 500), ...p, model: 'google/gemini-3-flash-preview' },
      });
    }

    return new Response(JSON.stringify({ success: true, ...p }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
