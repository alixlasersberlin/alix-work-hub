// Transcribes a voicemail (voicemail_url) via Lovable AI Gateway (STT).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireProcessAccess } from '../_shared/process-access.ts';
import { allowedVoiceMedia } from '../_shared/media-url-policy.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const access = await requireProcessAccess(req, corsHeaders, []);
  if ('response' in access) return access.response;
  try {
    const { call_id } = await req.json();
    if (typeof call_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(call_id)) return json({ error: 'call_id required' }, 400);

    const sb = access.client;
    const { data: call, error } = await sb.from('ac_calls').select('id, voicemail_url, contact_id, customer_id, agent_user_id').eq('id', call_id).single();
    if (error || !call) return json({ error: 'call not found' }, 404);
    if (!access.machine) {
      let permitted = false;
      if (call.contact_id) {
        const { data: contact, error: scopeError } = await sb.from('ac_contacts').select('tenant_id').eq('id', call.contact_id).maybeSingle();
        permitted = !scopeError && !!contact?.tenant_id && access.tenantIds.includes(contact.tenant_id);
      }
      if (!permitted) return json({ error: 'call_scope_unconfirmed' }, 403);
    }
    if (!call.voicemail_url) return json({ error: 'no voicemail_url' }, 400);
    if (!allowedVoiceMedia(call.voicemail_url, Deno.env.get('SUPABASE_URL') ?? '')) return json({ error: 'media_host_unconfirmed' }, 403);

    await sb.from('ac_calls').update({ voicemail_transcript_status: 'processing' }).eq('id', call_id);

    const audioRes = await fetch(call.voicemail_url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!audioRes.ok) {
      await sb.from('ac_calls').update({ voicemail_transcript_status: 'failed' }).eq('id', call_id);
      return json({ error: `audio fetch ${audioRes.status}` }, 502);
    }
    const size = Number(audioRes.headers.get('content-length') ?? 0);
    if (size > 25_000_000) { await audioRes.body?.cancel(); return json({ error: 'audio_too_large' }, 413); }
    const audioBlob = await audioRes.blob();
    if (audioBlob.size > 25_000_000) return json({ error: 'audio_too_large' }, 413);
    const ct = audioBlob.type || 'audio/mpeg';
    const ext = ct.includes('wav') ? 'wav' : ct.includes('mp4') ? 'mp4' : ct.includes('webm') ? 'webm' : 'mp3';

    const form = new FormData();
    form.append('model', 'openai/gpt-transcribe');
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
