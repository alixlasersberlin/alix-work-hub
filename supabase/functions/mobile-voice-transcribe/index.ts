// Edge Function: mobile-voice-transcribe
// Nimmt eine Audio-Datei (multipart/form-data 'file') vom Techniker entgegen,
// leitet sie an die Lovable AI Gateway STT weiter (openai/gpt-transcribe)
// und schreibt das Transkript optional als ticket_message oder route-plan-Notiz.

import { requireCallerAccess } from '../_shared/caller-access.ts';
import { isUuid } from '../_shared/security-core.ts';

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
    const access = await requireCallerAccess(req, cors);
    if ('response' in access) return access.response;
    const supa = access.caller;
    const user = access.user;

    const form = await req.formData();
    const file = form.get('file');
    const ticket_id = String(form.get('ticket_id') ?? '') || null;
    const route_plan_id = String(form.get('route_plan_id') ?? '') || null;
    if (!(file instanceof File)) return json({ error: 'file missing' }, 400);
    if (file.size < 1024) return json({ error: 'audio too short' }, 400);
    if (file.size > 24 * 1024 * 1024) return json({ error: 'audio too large' }, 400);
    if (ticket_id) {
      if (!isUuid(ticket_id)) return json({ error: 'Ungültiges Ticket' }, 400);
      const { data: ticket, error } = await supa.from('tickets').select('id').eq('id', ticket_id).maybeSingle();
      if (error || !ticket) return json({ error: 'Ticket nicht zugänglich' }, 404);
    }
    if (route_plan_id) {
      if (!isUuid(route_plan_id)) return json({ error: 'Ungültige Tour' }, 400);
      const { data: route, error } = await supa.from('route_plans').select('id').eq('id', route_plan_id).maybeSingle();
      if (error || !route) return json({ error: 'Tour nicht zugänglich' }, 404);
    }

    const upstream = new FormData();
    upstream.append('model', 'openai/gpt-transcribe');
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
      const { error } = await supa.from('ticket_messages').insert({
        ticket_id, sender_type: 'agent', sender_name: 'Mitarbeiter',
        message: `🎙️ Sprachnotiz (Techniker):\n\n${text}`, is_internal: true,
      });
      if (error) return json({ error: 'Sprachnotiz konnte nicht gespeichert werden', text }, 409);
    }
    return json({ text, ticket_id, route_plan_id });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
}
