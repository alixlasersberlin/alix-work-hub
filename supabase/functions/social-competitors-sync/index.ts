// Competitor benchmarking: erzeugt deterministische Snapshots pro Wettbewerber.
// TODO: Provider-APIs für echte Follower/Engagement-Daten anbinden (Meta Graph, TikTok, LinkedIn).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const today = new Date().toISOString().slice(0, 10);
    const q = svc.from('social_competitors').select('id, handle, client_id');
    if (body.client_id) q.eq('client_id', body.client_id);
    if (body.competitor_id) q.eq('id', body.competitor_id);
    const { data: comps, error } = await q;
    if (error) return json({ error: error.message }, 500);
    let n = 0;
    for (const c of comps ?? []) {
      const snap = fakeSnap(c.handle, today);
      await svc.from('social_competitor_snapshots').upsert(
        { competitor_id: c.id, snapshot_date: today, ...snap },
        { onConflict: 'competitor_id,snapshot_date' },
      );
      await svc.from('social_competitors').update({ last_snapshot_at: new Date().toISOString() }).eq('id', c.id);
      n++;
    }
    return json({ ok: true, updated: n });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
