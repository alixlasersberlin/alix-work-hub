// Social Media Publisher.
// Actions:
//   - 'enqueue' { post_id, scheduled_for? } → legt einen Publish-Job an, setzt Post-Status auf 'scheduled'.
//   - 'run_now' { job_id }                  → verarbeitet einen Job sofort.
//   - 'process_due' {}                      → verarbeitet alle fälligen Jobs (Cron).
//
// Hinweis: Der eigentliche Provider-Upload (Meta Graph, TikTok, LinkedIn …) ist als Stub
// implementiert. Jeder Job wird als 'done' markiert und eine simulierte external_url gesetzt,
// sodass der Freigabe-/Kalender-/Analytics-Flow Ende-zu-Ende funktioniert. Sobald echte
// OAuth-Tokens verfügbar sind, wird `publishToProvider()` erweitert.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function publishToProvider(post: any): Promise<{ external_post_id: string; external_url: string }> {
  // TODO: echte Integrationen (Meta Graph, TikTok, LinkedIn ...) einbauen, sobald OAuth-Flow bereit.
  const stubId = `stub_${crypto.randomUUID().slice(0, 8)}`;
  const stubUrl = `https://${post.platform}.local/p/${stubId}`;
  return { external_post_id: stubId, external_url: stubUrl };
}

async function processJob(svc: any, jobId: string) {
  const { data: job } = await svc
    .from('social_publish_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();
  if (!job) return { ok: false, error: 'job_not_found' };
  if (['done', 'cancelled'].includes(job.status)) return { ok: true, skipped: true };

  await svc.from('social_publish_jobs').update({
    status: 'running',
    started_at: new Date().toISOString(),
    attempts: (job.attempts ?? 0) + 1,
  }).eq('id', jobId);

  const { data: post } = await svc
    .from('social_posts')
    .select('*')
    .eq('id', job.post_id)
    .maybeSingle();

  try {
    if (!post) throw new Error('post not found');
    const { external_post_id, external_url } = await publishToProvider(post);

    await svc.from('social_publish_jobs').update({
      status: 'done',
      finished_at: new Date().toISOString(),
      external_post_id,
      external_url,
      last_error: null,
    }).eq('id', jobId);

    await svc.from('social_posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
    }).eq('id', post.id);

    // Initial-Metric-Row anlegen, damit Analytics-Dashboards die Verteilung zeigen.
    await svc.from('social_post_metrics').upsert({
      post_id: post.id,
      client_id: post.client_id,
      platform: post.platform,
      metric_date: new Date().toISOString().slice(0, 10),
      source: 'publish_bootstrap',
      meta: { external_post_id, external_url },
    }, { onConflict: 'post_id,metric_date' });

    return { ok: true, external_post_id, external_url };
  } catch (e: any) {
    const attempts = (job.attempts ?? 0) + 1;
    const failed = attempts >= (job.max_attempts ?? 5);
    await svc.from('social_publish_jobs').update({
      status: failed ? 'failed' : 'queued',
      last_error: String(e?.message ?? e),
      finished_at: failed ? new Date().toISOString() : null,
      scheduled_for: failed ? job.scheduled_for : new Date(Date.now() + attempts * 60_000).toISOString(),
    }).eq('id', jobId);
    return { ok: false, error: String(e?.message ?? e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    // 'process_due' darf auch vom Cron ohne User-JWT kommen.
    if (action === 'process_due') {
      const { data: jobs } = await svc
        .from('social_publish_jobs')
        .select('id')
        .eq('status', 'queued')
        .lte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(25);
      const results: any[] = [];
      for (const j of jobs ?? []) results.push({ id: j.id, ...(await processJob(svc, j.id)) });
      return json({ processed: results.length, results });
    }

    // Alle anderen Aktionen benötigen einen angemeldeten Social-Admin/-Marketing.
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const { data: canManage } = await svc.rpc('can_admin_social');
    if (!canManage) return json({ error: 'Forbidden' }, 403);

    if (action === 'enqueue') {
      const postId = body?.post_id as string;
      if (!postId) return json({ error: 'post_id required' }, 400);
      const { data: post, error: pe } = await svc
        .from('social_posts').select('*').eq('id', postId).maybeSingle();
      if (pe || !post) return json({ error: 'post not found' }, 404);

      const scheduledFor = body?.scheduled_for
        ? new Date(body.scheduled_for).toISOString()
        : (post.scheduled_at ?? new Date().toISOString());

      const { data: job, error: je } = await svc.from('social_publish_jobs').insert({
        post_id: post.id,
        client_id: post.client_id,
        platform: post.platform,
        scheduled_for: scheduledFor,
        requested_by: userId,
      }).select().single();
      if (je) return json({ error: je.message }, 500);

      await svc.from('social_posts').update({ status: 'scheduled', scheduled_at: scheduledFor }).eq('id', post.id);
      return json({ ok: true, job });
    }

    if (action === 'run_now') {
      const jobId = body?.job_id as string;
      if (!jobId) return json({ error: 'job_id required' }, 400);
      return json(await processJob(svc, jobId));
    }

    if (action === 'cancel') {
      const jobId = body?.job_id as string;
      if (!jobId) return json({ error: 'job_id required' }, 400);
      await svc.from('social_publish_jobs').update({ status: 'cancelled', finished_at: new Date().toISOString() }).eq('id', jobId);
      return json({ ok: true });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
