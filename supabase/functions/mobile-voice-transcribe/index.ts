// Edge Function: mobile-voice-transcribe
// Nimmt eine Audio-Datei (multipart/form-data 'file') vom Techniker entgegen,
// leitet sie an die Lovable AI Gateway STT weiter (openai/gpt-4o-mini-transcribe)
// und schreibt das Transkript optional als ticket_message oder route-plan-Notiz.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const LOVABLE = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE) return json({ error: 'LOVABLE_API_KEY missing' }, 500);
    const authHeader = req.headers.get('Authorization') ?? '';
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supa.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return json({ error: 'unauthorized' }, 401);

    const form = await req.formData();
    const file = form.get('file');
    const ticket_id = String(form.get('ticket_id') ?? '') || null;
    const route_plan_id = String(form.get('route_plan_id') ?? '') || null;
    if (!(file instanceof File)) return json({ error: 'file missing' }, 400);
    if (file.size < 1024) return json({ error: 'audio too short' }, 400);
    if (file.size > 24 * 1024 * 1024) return json({ error: 'audio too large' }, 400);

    const upstream = new FormData();
    upstream.append('model', 'openai/gpt-4o-mini-transcribe');
    const ext = ({ 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg' } as any)[file.type.split(';')[0]] ?? 'webm';
    upstream.append('file', file, `voice.${ext}`);

    const r = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE}` },
      body: upstream,
    });
    if (!r.ok) return json({ error: `STT ${r.status}: ${await r.text().catch(() => '')}` }, r.status === 402 ? 402 : 500);
    const { text } = await r.json() as { text: string };

    if (ticket_id && text) {
      await supa.from('ticket_messages').insert({
        ticket_id, author_id: user.id, body: `🎙️ Sprachnotiz (Techniker):\n\n${text}`, is_internal: true,
      } as any);
    }
    return json({ text, ticket_id, route_plan_id });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
}
