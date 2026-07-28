// Erzeugt einen Report-Datensatz für einen Zeitraum. Als "PDF" wird eine HTML-Textzusammenfassung
// im Storage-Bucket 'social-media-library' unter reports/{client}/{period}.html abgelegt.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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
    const userId = c.claims.sub as string;
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: can } = await svc.rpc('can_admin_social');
    if (!can) return json({ error: 'Forbidden' }, 403);

    const { client_id, period_start, period_end } = await req.json();

    const [{ data: client }, { data: posts }, { data: metrics }] = await Promise.all([
      svc.from('social_clients').select('company_name').eq('id', client_id).maybeSingle(),
      svc.from('social_posts').select('id,platform,status,published_at').eq('client_id', client_id).gte('created_at', period_start).lte('created_at', period_end),
      svc.from('social_post_metrics').select('impressions,reach,likes,comments,shares,clicks,engagement_rate,platform').eq('client_id', client_id).gte('metric_date', period_start).lte('metric_date', period_end),
    ]);

    const totals = (metrics ?? []).reduce((a: any, m: any) => ({
      impressions: a.impressions + (m.impressions ?? 0),
      reach: a.reach + (m.reach ?? 0),
      likes: a.likes + (m.likes ?? 0),
      comments: a.comments + (m.comments ?? 0),
      shares: a.shares + (m.shares ?? 0),
      clicks: a.clicks + (m.clicks ?? 0),
    }), { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0 });

    const summary = {
      client: client?.company_name ?? '—',
      posts_total: posts?.length ?? 0,
      posts_published: posts?.filter((p: any) => p.status === 'published').length ?? 0,
      totals,
    };

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Report ${period_start} – ${period_end}</title>
<style>body{font-family:system-ui;max-width:800px;margin:2rem auto;padding:0 1rem;color:#111}
h1{border-bottom:2px solid #d4af37;padding-bottom:.5rem} table{width:100%;border-collapse:collapse;margin-top:1rem}
td,th{padding:.5rem;border-bottom:1px solid #eee;text-align:left}</style></head>
<body><h1>Social-Media-Report</h1>
<p><strong>${summary.client}</strong> · ${period_start} bis ${period_end}</p>
<h2>Zusammenfassung</h2>
<table>
<tr><th>Beiträge gesamt</th><td>${summary.posts_total}</td></tr>
<tr><th>Veröffentlicht</th><td>${summary.posts_published}</td></tr>
<tr><th>Impressions</th><td>${totals.impressions.toLocaleString('de-DE')}</td></tr>
<tr><th>Reichweite</th><td>${totals.reach.toLocaleString('de-DE')}</td></tr>
<tr><th>Likes</th><td>${totals.likes.toLocaleString('de-DE')}</td></tr>
<tr><th>Kommentare</th><td>${totals.comments.toLocaleString('de-DE')}</td></tr>
<tr><th>Shares</th><td>${totals.shares.toLocaleString('de-DE')}</td></tr>
<tr><th>Klicks</th><td>${totals.clicks.toLocaleString('de-DE')}</td></tr>
</table>
<p style="margin-top:2rem;color:#888;font-size:.85em">Automatisch erzeugt von AlixWork · Social Media Reporting.</p>
</body></html>`;

    const path = `reports/${client_id}/${period_start}_${period_end}.html`;
    await svc.storage.from('social-media-library').upload(path, new Blob([html], { type: 'text/html' }), { upsert: true });

    const { data: rep, error } = await svc.from('social_reports').insert({
      client_id, period_start, period_end, status: 'ready',
      pdf_path: path, summary, generated_by: userId,
    }).select().single();
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, report: rep });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
