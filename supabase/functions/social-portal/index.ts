// Öffentliches Kunden-Portal für Analytics (Read-Only via Token).
// GET ?token=xxx  -> { client, kpis, series, reports }
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token) return json({ error: 'missing token' }, 400);
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: link } = await svc.from('social_portal_links').select('*').eq('token', token).maybeSingle();
    if (!link) return json({ error: 'invalid token' }, 404);
    if (link.disabled_at) return json({ error: 'disabled' }, 403);
    if (link.expires_at && new Date(link.expires_at) < new Date()) return json({ error: 'expired' }, 403);

    await svc.from('social_portal_links').update({
      view_count: (link.view_count ?? 0) + 1,
      last_viewed_at: new Date().toISOString(),
    }).eq('id', link.id);

    const clientId = link.client_id;
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const [{ data: client }, { data: posts }, { data: metrics }] = await Promise.all([
      svc.from('social_clients').select('company_name').eq('id', clientId).maybeSingle(),
      svc.from('social_posts').select('id,title,platform,status,published_at').eq('client_id', clientId).eq('status', 'published').order('published_at', { ascending: false }).limit(10),
      svc.from('social_post_metrics').select('metric_date,platform,impressions,reach,likes,comments,shares,clicks,engagement_rate').eq('client_id', clientId).gte('metric_date', from).order('metric_date'),
    ]);

    const kpis = (metrics ?? []).reduce((a: any, m: any) => ({
      impressions: a.impressions + (m.impressions ?? 0),
      reach: a.reach + (m.reach ?? 0),
      likes: a.likes + (m.likes ?? 0),
      engagement: a.engagement + (Number(m.engagement_rate) || 0),
      n: a.n + 1,
    }), { impressions: 0, reach: 0, likes: 0, engagement: 0, n: 0 });

    return json({
      client: client?.company_name ?? '—',
      kpis: { ...kpis, avg_engagement_rate: kpis.n ? Number((kpis.engagement / kpis.n).toFixed(2)) : 0 },
      series: metrics ?? [],
      recent_posts: posts ?? [],
    });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
