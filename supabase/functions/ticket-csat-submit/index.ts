// Öffentlicher Endpunkt: GET liefert Umfrage-Metadaten, POST speichert Bewertung.
import { createClient } from 'npm:@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';

  const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (!token || !/^[a-f0-9]{20,80}$/i.test(token)) return json({ error: 'invalid_token' }, 400);

  const { data: survey } = await sb
    .from('ticket_csat_surveys')
    .select('id, ticket_id, rating, responded_at, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!survey) return json({ error: 'not_found' }, 404);
  if (survey.expires_at && new Date(survey.expires_at) < new Date()) return json({ error: 'expired' }, 410);

  if (req.method === 'GET') {
    const { data: t } = await sb.from('tickets').select('ticket_number, subject, title').eq('id', survey.ticket_id).maybeSingle();
    return json({
      already: !!survey.responded_at,
      rating: survey.rating,
      ticket_number: t?.ticket_number,
      subject: t?.subject ?? t?.title ?? '',
    });
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const rating = Number(body?.rating);
    const comment = typeof body?.comment === 'string' ? body.comment.slice(0, 2000) : null;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: 'invalid_rating' }, 400);

    const { error: upErr } = await sb.from('ticket_csat_surveys').update({
      rating, comment, responded_at: new Date().toISOString(),
    }).eq('id', survey.id);
    if (upErr) return json({ error: upErr.message }, 500);
    return json({ ok: true });
  }

  return json({ error: 'method_not_allowed' }, 405);
});
