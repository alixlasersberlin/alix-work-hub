// KI-gestützte Hashtag-Recherche via Lovable AI Gateway.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: c } = await userClient.auth.getClaims(auth.replace('Bearer ', ''));
    if (!c?.claims) return json({ error: 'Unauthorized' }, 401);
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: can } = await svc.rpc('can_admin_social');
    if (!can) return json({ error: 'Forbidden' }, 403);

    const body = await req.json();
    const { client_id, platform, topic } = body;
    if (!client_id || !platform || !topic) return json({ error: 'missing fields' }, 400);

    const prompt = `Erzeuge 10 hoch relevante Hashtags für Plattform "${platform}" zum Thema "${topic}". Antworte AUSSCHLIESSLICH als JSON-Array von Objekten mit Feldern: hashtag (mit #), volume (geschätzt, Zahl), difficulty (0-100), trend ("rising"|"stable"|"falling"), suggested_best_time (ISO-Zeitpunkt in den nächsten 7 Tagen).`;

    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });
    if (!r.ok) return json({ error: 'AI failed', details: await r.text() }, 502);
    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content ?? '[]';
    let arr: any[] = [];
    try { const p = JSON.parse(raw); arr = Array.isArray(p) ? p : (p.hashtags ?? p.data ?? []); } catch {}
    for (const h of arr) {
      await svc.from('social_hashtag_research').insert({
        client_id, platform,
        hashtag: h.hashtag ?? h.tag,
        volume: Number(h.volume) || 0,
        difficulty: Number(h.difficulty) || 0,
        trend: h.trend ?? 'stable',
        suggested_best_time: h.suggested_best_time ?? null,
        ai_notes: h.notes ?? null,
      });
    }
    return json({ ok: true, count: arr.length });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
