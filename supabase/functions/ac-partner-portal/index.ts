import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Lightweight Partner & Reseller intelligence layer.
// Uses existing sig_partners + sig_partner_usage as the base.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'overview');

    if (action === 'overview') {
      const { data: partners } = await supabase
        .from('sig_partners')
        .select('id, name, status, tier, contact_email, created_at')
        .limit(200);
      const { data: usage } = await supabase
        .from('sig_partner_usage')
        .select('partner_id, event, occurred_at')
        .gte('occurred_at', new Date(Date.now() - 90 * 864e5).toISOString())
        .limit(2000);
      const byPartner: Record<string, { events: number; last: string | null }> = {};
      for (const u of usage ?? []) {
        const p = (byPartner[u.partner_id] ??= { events: 0, last: null });
        p.events += 1;
        if (!p.last || u.occurred_at > p.last) p.last = u.occurred_at;
      }
      const enriched = (partners ?? []).map((p: any) => ({
        ...p,
        events_90d: byPartner[p.id]?.events ?? 0,
        last_activity: byPartner[p.id]?.last ?? null,
        health: (byPartner[p.id]?.events ?? 0) >= 20 ? 'strong' : (byPartner[p.id]?.events ?? 0) >= 5 ? 'ok' : 'quiet',
      }));
      return json({
        partners: enriched,
        totals: {
          count: enriched.length,
          active: enriched.filter((p) => p.status === 'active').length,
          events_90d: (usage ?? []).length,
        },
      });
    }

    if (action === 'commission_estimate') {
      const partner_id = String(body.partner_id ?? '');
      const rate = Number(body.rate ?? 0.1);
      if (!partner_id) return json({ error: 'partner_id required' }, 400);
      const { data: rows } = await supabase
        .from('sig_partner_usage')
        .select('event, occurred_at, meta')
        .eq('partner_id', partner_id)
        .gte('occurred_at', new Date(Date.now() - 365 * 864e5).toISOString())
        .limit(5000);
      const revenue = (rows ?? []).reduce((s: number, r: any) => s + Number(r?.meta?.amount ?? 0), 0);
      return json({ partner_id, rate, revenue, commission: Math.round(revenue * rate * 100) / 100, events: rows?.length ?? 0 });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message ?? 'error' }, 500);
  }
});

function json(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
