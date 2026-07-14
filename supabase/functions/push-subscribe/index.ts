import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: authErr } = await supabaseAuth.auth.getClaims(token);
  if (authErr || !claimsData?.claims?.sub) return json({ error: 'Unauthorized' }, 401);
  const userId = claimsData.claims.sub;

  const body = await req.json().catch(() => ({}));
  const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  if (body.remove) {
    if (body.endpoint) {
      await svc.from('mobile_push_subscriptions').delete().eq('user_id', userId).eq('endpoint', body.endpoint);
    } else if (body.native_token) {
      await svc.from('mobile_push_subscriptions').delete().eq('user_id', userId).eq('native_token', body.native_token);
    }
    return json({ ok: true, removed: true });
  }

  const { endpoint, p256dh, auth, user_agent, platform, native_token } = body || {};

  // Native (iOS/Android via Capacitor)
  if ((platform === 'ios' || platform === 'android') && native_token) {
    const { error } = await svc.from('mobile_push_subscriptions').upsert({
      user_id: userId,
      platform,
      native_token,
      endpoint: null,
      p256dh: null,
      auth_key: null,
      user_agent: user_agent ?? null,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform,native_token' });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, platform });
  }

  // Web-Push (VAPID)
  if (!endpoint || !p256dh || !auth) return json({ error: 'invalid subscription' }, 400);

  const { error } = await svc.from('mobile_push_subscriptions').upsert({
    user_id: userId,
    platform: 'web',
    endpoint,
    p256dh,
    auth_key: auth,
    user_agent: user_agent ?? null,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'user_id,endpoint' });

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});

function json(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
