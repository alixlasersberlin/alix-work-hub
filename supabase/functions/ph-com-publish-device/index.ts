// Compatibility entrypoint: all COM releases use the protected GLOBAL sender.
// Never fall back to the legacy translations/master-data PATCH endpoints.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Nur POST erlaubt' });
  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return json(401, { ok: false, error: 'Nicht angemeldet' });
  const parsed = z.object({ product_id: z.string().uuid(), dry_run: z.boolean().optional() }).strict().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { ok: false, error: 'Ungültige Anfrage' });
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) return json(503, { ok: false, error: 'GLOBAL-Versand nicht eingerichtet' });
  try {
    const reply = await fetch(`${url}/functions/v1/ph-global-publish-device`, {
      method: 'POST', headers: { authorization, apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...parsed.data, channel: 'com' }), redirect: 'manual', signal: AbortSignal.timeout(210000),
    });
    return new Response(await reply.text(), { status: reply.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch {
    return json(502, { ok: false, online: false, error: 'GLOBAL-Übertragungsstand unklar; nicht erneut senden' });
  }
});
