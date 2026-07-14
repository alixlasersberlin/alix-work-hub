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

  if (body.remove && body.endpoint) {
    await svc.from('mobile_push_subscriptions').delete().eq('user_id', userId).eq('endpoint', body.endpoint);
    return json({ ok: true, removed: true });
  }

  const { endpoint, p256dh, auth, user_agent } = body || {};
  if (!endpoint || !p256dh || !auth) return json({ error: 'invalid subscription' }, 400);

  const { error } = await svc.from('mobile_push_subscriptions').upsert({
    user_id: userId,
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
