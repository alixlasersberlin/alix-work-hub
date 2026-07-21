import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Phase 39 — Field Service & Dispatch 2.0.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return j({ error: 'Unauthorized' }, 401);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error } = await supabase.auth.getClaims(token);
    if (error || !claims?.claims) return j({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'overview');

    if (action === 'overview') {
      const today = new Date(); today.setHours(0,0,0,0);
      const iso = today.toISOString();
      const { data: appts } = await supabase
        .from('esc_appointments')
        .select('id, title, starts_at, ends_at, status, assignee_id, customer_id')
        .gte('starts_at', iso)
        .lt('starts_at', new Date(today.getTime()+7*864e5).toISOString())
        .order('starts_at')
        .limit(200);

      const buckets: Record<string, number> = { scheduled: 0, in_progress: 0, done: 0, cancelled: 0 };
      for (const a of appts ?? []) buckets[a.status ?? 'scheduled'] = (buckets[a.status ?? 'scheduled'] ?? 0) + 1;

      return j({
        appointments: appts ?? [],
        totals: { week: (appts ?? []).length, ...buckets },
      });
    }

    if (action === 'eta') {
      // Simple ETA heuristic based on straight-line distance
      const dLat = Number(body.dst_lat), dLng = Number(body.dst_lng);
      const oLat = Number(body.src_lat), oLng = Number(body.src_lng);
      const R = 6371;
      const toRad = (d: number) => d * Math.PI / 180;
      const dLatR = toRad(dLat - oLat), dLngR = toRad(dLng - oLng);
      const a = Math.sin(dLatR/2)**2 + Math.cos(toRad(oLat))*Math.cos(toRad(dLat))*Math.sin(dLngR/2)**2;
      const km = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const avgKmh = 55;
      const minutes = Math.round(km / avgKmh * 60 * 1.15);
      return j({ km: Math.round(km*10)/10, eta_minutes: minutes, eta_iso: new Date(Date.now()+minutes*60000).toISOString() });
    }

    return j({ error: 'unknown action' }, 400);
  } catch (e: any) {
    return j({ error: e.message ?? 'error' }, 500);
  }
});
function j(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
