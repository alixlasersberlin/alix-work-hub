import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { RECEIVERS } from '../_shared/ph-delivery.ts';
const Body = z.object({ channel: z.enum(['de','com','dubai']) });
const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) return json(503, { error: 'configuration_missing' });
  const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json(401, { error: 'Nicht angemeldet' });
  const [{ data: profile }, { data: admin }] = await Promise.all([
    caller.from('user_profiles').select('account_status,invitation_status,password_reset_required').eq('id', user.id).maybeSingle(), caller.rpc('is_admin'),
  ]);
  if (profile?.account_status !== 'active' || profile.invitation_status !== 'accepted' || profile.password_reset_required !== false || admin !== true) return json(403, { error: 'Nur aktive Administratoren' });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json(400, { error: body.error.flatten().fieldErrors });
  try {
    const result = await fetch(RECEIVERS[body.data.channel], { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(5000) });
    await result.body?.cancel();
    return json(200, { channel: body.data.channel, http_status: result.status, verified: false,
      message: result.status === 404 || result.status === 410 ? 'Empfangsmodul noch nicht verfügbar' : 'Empfänger antwortet; durchgängige Abnahme ausstehend',
      checked_at: new Date().toISOString() });
  } catch { return json(200, { verified: false, message: 'Empfänger nicht erreichbar', checked_at: new Date().toISOString() }); }
});