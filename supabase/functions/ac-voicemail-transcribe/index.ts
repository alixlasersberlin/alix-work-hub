// Transcribes a voicemail (voicemail_url) via Lovable AI Gateway (STT).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { call_id } = await req.json();
    if (!call_id) return json({ error: 'call_id required' }, 400);

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: call, error } = await sb.from('ac_calls').select('id, voicemail_url').eq('id', call_id).single();
    if (error || !call) return json({ error: 'call not found' }, 404);
    if (!call.voicemail_url) return json({ error: 'no voicemail_url' }, 400);

    await sb.from('ac_calls').update({ voicemail_transcript_status: 'processing' }).eq('id', call_id);

    const audioRes = await fetch(call.voicemail_url);
    if (!audioRes.ok) {
      await sb.from('ac_calls').update({ voicemail_transcript_status: 'failed' }).eq('id', call_id);
      return json({ error: `audio fetch ${audioRes.status}` }, 502);
    }
    const audioBlob = await audioRes.blob();
    const ct = audioBlob.type || 'audio/mpeg';
    const ext = ct.includes('wav') ? 'wav' : ct.includes('mp4') ? 'mp4' : ct.includes('webm') ? 'webm' : 'mp3';

    const form = new FormData();
    form.append('model', 'openai/gpt-4o-mini-transcribe');
    form.append('file', audioBlob, `voicemail.${ext}`);

    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return json({ error: 'LOVABLE_API_KEY missing' }, 500);

    const r = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const body = await r.text();
    if (!r.ok) {
      await sb.from('ac_calls').update({ voicemail_transcript_status: 'failed', voicemail_transcript: body.slice(0, 500) }).eq('id', call_id);
      return json({ error: 'STT failed', status: r.status, details: body }, r.status);
    }
    const parsed = JSON.parse(body);
    const text = parsed.text ?? '';
    await sb.from('ac_calls').update({
      voicemail_transcript: text,
      voicemail_transcript_status: 'done',
      voicemail_transcribed_at: new Date().toISOString(),
    }).eq('id', call_id);

    return json({ ok: true, text });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
