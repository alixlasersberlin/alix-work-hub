import { requireCallerAccess } from '../_shared/caller-access.ts';
// Multilingual Real-Time Translation — 30+ languages, tone- and terminology-aware.

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
    const { text, target_lang, source_lang = 'auto', tone = 'professionell', domain = 'customer_support', contact_id } = await req.json();
    if (!text || !target_lang) throw new Error('text and target_lang required');
    if (typeof text !== 'string' || !text.trim() || text.length > 20000) return new Response(JSON.stringify({ error: 'Invalid text' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    for (const [table, id] of [['ac_contacts', contact_id]] as const) {
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
          { role: 'system', content: 'Du bist Live-Übersetzer für Kundenkommunikation. Erkenne Ausgangssprache falls "auto". Übersetze tonalitäts- und fachbegriff-getreu. Antworte NUR mit JSON: {"detected_source_lang":string,"target_lang":string,"translation":string,"tone_applied":string,"glossary_notes":[{"term":string,"note":string}],"confidence":number}' },
          { role: 'user', content: `Ausgangssprache: ${source_lang}\nZielsprache: ${target_lang}\nTonalität: ${tone}\nDomain: ${domain}\n---\n${text}` },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (r.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const p = (() => { try { return JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { return {}; } })();

    if (contact_id) {
      const sb = access.caller;
      await sb.from('ac_predictions').insert({
        contact_id,
        kind: 'live_translation',
        score: Number(p.confidence ?? 0.9),
        risk_level: 'low',
        suggested_action: `${p.detected_source_lang ?? source_lang} → ${target_lang}`,
        payload: { source_text: String(text).slice(0, 500), ...p, tone, domain, model: 'google/gemini-3-flash-preview' },
      });
    }

    return new Response(JSON.stringify({ success: true, ...p }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
