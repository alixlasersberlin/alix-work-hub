// Speech-to-Text für das Self-Service-Portal (Sprach-Eingabe).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AI_KEY = Deno.env.get('LOVABLE_API_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return new Response(JSON.stringify({ error: 'file required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (file.size < 2048) return new Response(JSON.stringify({ error: 'audio_too_short' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const upstream = new FormData();
    upstream.append('model', 'openai/gpt-4o-mini-transcribe');
    upstream.append('file', file, file.name || 'recording.webm');

    const r = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${AI_KEY}` },
      body: upstream,
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (r.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!r.ok) return new Response(JSON.stringify({ error: `stt ${r.status}`, details: await r.text() }), { status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const j = await r.json();
    return new Response(JSON.stringify({ ok: true, text: j.text ?? '' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
