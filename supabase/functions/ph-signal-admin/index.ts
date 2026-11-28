import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { RECEIVERS } from '../_shared/ph-delivery.ts';
import { fullTest } from '../_shared/ph-full-test.ts';
const Body = z.union([z.object({ action: z.literal('overview') }), z.object({ action: z.literal('full_test'), channel: z.enum(['de','com']) }), z.object({ action: z.literal('test').optional(), channel: z.enum(['de','com','dubai']) })]);
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
  if ('action' in body.data && body.data.action === 'overview') {
    // Booleans only: secret values never leave the server.
    const channels = Object.fromEntries(Object.keys(RECEIVERS).map(c => [c, {
      receiver_url: RECEIVERS[c], signal_auth: !!Deno.env.get(`PH_NOTIFY_SECRET_${c.toUpperCase()}`),
      receipt_auth: !!Deno.env.get(`PH_STATUS_SECRET_${c.toUpperCase()}`) }]));
    return json(200, { live_enabled: Deno.env.get('PH_SIGNAL_LIVE_ENABLED') === 'true', api_key: !!Deno.env.get('PRODUCT_HUB_API_KEY'), channels });
  }
  if ('action' in body.data && body.data.action === 'full_test') return json(200, await fullTest(body.data.channel, user.id));
  const channel = (body.data as { channel: 'de'|'com'|'dubai' }).channel;
  try {
    const result = await fetch(RECEIVERS[channel], { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(5000) });
    await result.body?.cancel();
    return json(200, { channel, http_status: result.status, verified: false,
      message: result.status === 404 || result.status === 410 ? 'Empfangsmodul noch nicht verfügbar' : result.status === 405 ? 'Empfänger erreichbar (Authentifizierung nicht geprüft)' : result.status === 401 ? 'Empfänger erreichbar · Authentifizierung erforderlich' : result.status >= 500 ? 'Verbindungsfehler' : 'Empfänger erreichbar',
      checked_at: new Date().toISOString() });
  } catch { return json(200, { verified: false, message: 'Empfänger nicht erreichbar', checked_at: new Date().toISOString() }); }
});

