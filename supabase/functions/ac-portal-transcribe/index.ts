// Speech-to-Text für das Self-Service-Portal (Sprach-Eingabe).
import { createClient } from 'npm:@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AI_KEY = Deno.env.get('LOVABLE_API_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  try {
    // Public portal input: bound per client address and request size to prevent paid-API abuse.
    const len = Number(req.headers.get('content-length') ?? '0');
    if (len > 10 * 1024 * 1024) return new Response(JSON.stringify({ error: 'file_too_large' }), { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: limited, error: limitError } = await admin.rpc('check_rate_limit', { _bucket: `ac-portal-transcribe:${ip}`, _max: 10, _window_seconds: 600 });
    if (limitError || limited === true) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return new Response(JSON.stringify({ error: 'file required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (file.size > 10 * 1024 * 1024) return new Response(JSON.stringify({ error: 'file_too_large' }), { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (file.size < 2048) return new Response(JSON.stringify({ error: 'audio_too_short' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const upstream = new FormData();
    upstream.append('model', 'openai/gpt-transcribe');
    upstream.append('file', file, file.name || 'recording.webm');

    const r = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${AI_KEY}` },
      body: upstream,
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (r.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!r.ok) return new Response(JSON.stringify({ error: `stt ${r.status}` }), { status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const j = await r.json();
    return new Response(JSON.stringify({ ok: true, text: j.text ?? '' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
