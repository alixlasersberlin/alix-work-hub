// Voice-AI: Transcribes an ac_calls recording and produces sentiment + summary + action items.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AI_KEY = Deno.env.get('LOVABLE_API_KEY')!;

async function transcribe(url: string): Promise<string> {
  const audio = await fetch(url);
  if (!audio.ok) throw new Error(`fetch recording failed: ${audio.status}`);
  const blob = await audio.blob();
  const fd = new FormData();
  fd.append('model', 'openai/gpt-4o-mini-transcribe');
  fd.append('file', blob, 'recording.mp3');
  const r = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${AI_KEY}` },
    body: fd,
  });
  if (!r.ok) throw new Error(`STT ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.text || '';
}

async function analyze(transcript: string) {
  const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${AI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: 'Du bist ein Support-Analyst. Antworte NUR mit gültigem JSON: {"summary":string,"sentiment":"positiv"|"neutral"|"negativ","sentiment_score":number(-1..1),"action_items":string[]}' },
        { role: 'user', content: transcript.slice(0, 12000) },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const txt = j.choices?.[0]?.message?.content || '{}';
  try { return JSON.parse(txt); } catch { return {}; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { call_id } = await req.json();
    if (!call_id) return new Response(JSON.stringify({ error: 'call_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: call, error } = await sb.from('ac_calls').select('id, recording_url, transcript').eq('id', call_id).single();
    if (error || !call) throw new Error(error?.message || 'call not found');
    if (!call.recording_url) throw new Error('no recording_url on call');

    await sb.from('ac_calls').update({ transcript_status: 'processing' }).eq('id', call_id);

    const transcript = call.transcript || await transcribe(call.recording_url);
    const analysis = await analyze(transcript);

    await sb.from('ac_calls').update({
      transcript,
      transcript_status: 'done',
      summary: analysis.summary || null,
      sentiment: analysis.sentiment || null,
      sentiment_score: typeof analysis.sentiment_score === 'number' ? analysis.sentiment_score : null,
      action_items: Array.isArray(analysis.action_items) ? analysis.action_items : [],
      ai_processed_at: new Date().toISOString(),
    }).eq('id', call_id);

    return new Response(JSON.stringify({ ok: true, transcript, ...analysis }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
