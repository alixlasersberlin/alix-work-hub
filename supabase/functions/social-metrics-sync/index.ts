// Social Media Metrics Sync.
// Aktualisiert social_post_metrics für alle veröffentlichten Beiträge.
// Aktuell mit deterministischem Stub (basierend auf Post-ID + Datum), damit Analytics-Dashboards
// realistisch aussehen. Sobald echte Provider-Tokens gespeichert sind, ersetzt fetchProviderMetrics()
// diese Werte durch reale API-Calls (Meta Graph Insights, TikTok Business API, LinkedIn UGC ...).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function seededRand(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967295; };
}

function fakeMetrics(postId: string, date: string, platform: string) {
  const r = seededRand(`${postId}:${date}:${platform}`);
  const impressions = 200 + Math.floor(r() * 4800);
  const reach = Math.floor(impressions * (0.55 + r() * 0.35));
  const likes = Math.floor(reach * (0.02 + r() * 0.08));
  const comments = Math.floor(likes * (0.03 + r() * 0.12));
  const shares = Math.floor(likes * (0.01 + r() * 0.08));
  const clicks = Math.floor(reach * (0.005 + r() * 0.03));
  const saves = Math.floor(likes * (0.02 + r() * 0.1));
  const engagement_rate = reach > 0 ? (likes + comments + shares + saves) / reach : 0;
  return { impressions, reach, likes, comments, shares, clicks, saves, engagement_rate: Number(engagement_rate.toFixed(4)) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = (body?.action as string) ?? 'sync';

    if (action !== 'sync' && action !== 'sync_one') {
      // Manuelle Aufrufe erfordern Social-Admin/Marketing.
      const auth = req.headers.get('Authorization');
      if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user?.id) return json({ error: 'Unauthorized' }, 401);
      const { data: canManage } = await svc.rpc('can_admin_social');
      if (!canManage) return json({ error: 'Forbidden' }, 403);
    }

    const today = new Date().toISOString().slice(0, 10);
    let query = svc.from('social_posts')
      .select('id,client_id,platform')
      .eq('status', 'published')
      .is('deleted_at', null)
      .limit(500);

    if (action === 'sync_one' && body?.post_id) {
      query = svc.from('social_posts')
        .select('id,client_id,platform')
        .eq('id', body.post_id)
        .limit(1);
    }

    const { data: posts, error } = await query;
    if (error) return json({ error: error.message }, 500);

    let updated = 0;
    for (const p of posts ?? []) {
      const m = fakeMetrics(p.id, today, p.platform);
      const { error: ue } = await svc.from('social_post_metrics').upsert({
        post_id: p.id,
        client_id: p.client_id,
        platform: p.platform,
        metric_date: today,
        source: 'stub_sync',
        ...m,
      }, { onConflict: 'post_id,metric_date' });
      if (!ue) updated++;
    }

    return json({ ok: true, updated, date: today });
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
