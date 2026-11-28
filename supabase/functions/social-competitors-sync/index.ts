// Competitor benchmarking: erzeugt deterministische Snapshots pro Wettbewerber.
// TODO: Provider-APIs für echte Follower/Engagement-Daten anbinden (Meta Graph, TikTok, LinkedIn).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { z } from 'npm:zod@3.25.76';

const BodySchema = z.object({ client_id: z.string().uuid().optional(), competitor_id: z.string().uuid().optional() }).strict();

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function fakeSnap(handle: string, date: string) {
  let h = 0; const s = `${handle}|${date}`;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  const rnd = (n: number) => Math.abs((h = (h * 1103515245 + 12345) | 0)) % n;
  return {
    followers: 500 + rnd(50000),
    posts_count: 20 + rnd(500),
    avg_engagement_rate: Number((0.5 + (rnd(500) / 100)).toFixed(2)),
    top_hashtags: ['#trend', '#brand', `#${handle.replace(/[^a-z]/gi, '').toLowerCase()}`, '#viral'].slice(0, 3 + rnd(2)),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const access = await requireCallerAccess(req, corsHeaders);
    if ('response' in access) return access.response;
    const svc = access.caller;
    const { data: canWrite, error: permissionError } = await svc.rpc('can_admin_social');
    if (permissionError || canWrite !== true) return json({ error: 'Forbidden' }, 403);
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Invalid competitor or client identifier' }, 400);
    const body = parsed.data;
    const today = new Date().toISOString().slice(0, 10);
    const q = svc.from('social_competitors').select('id, handle, client_id');
    if (body.client_id) q.eq('client_id', body.client_id);
    if (body.competitor_id) q.eq('id', body.competitor_id);
    const { data: comps, error } = await q;
    if (error) return json({ error: error.message }, 500);
    let n = 0;
    for (const c of comps ?? []) {
      const snap = fakeSnap(c.handle, today);
      const { error: snapshotError } = await svc.from('social_competitor_snapshots').upsert(
        { competitor_id: c.id, snapshot_date: today, ...snap },
        { onConflict: 'competitor_id,snapshot_date' },
      );
      if (snapshotError) return json({ error: snapshotError.message }, 403);
      const { error: updateError } = await svc.from('social_competitors').update({ last_snapshot_at: new Date().toISOString() }).eq('id', c.id);
      if (updateError) return json({ error: updateError.message }, 403);
      n++;
    }
    return json({ ok: true, updated: n });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
