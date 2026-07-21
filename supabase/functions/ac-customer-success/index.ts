import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Phase 41 — Customer Success Automation. Onboarding/adoption tracking with churn risk.
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
      const since90 = new Date(Date.now() - 90*864e5).toISOString();
      const [{ data: customers }, { data: orders }, { data: tickets }] = await Promise.all([
        supabase.from('customers').select('id, name, created_at').limit(500).order('created_at', { ascending: false }),
        supabase.from('orders').select('customer_id, order_date').gte('order_date', since90).limit(3000),
        supabase.from('tickets').select('customer_id, status, created_at').gte('created_at', since90).limit(3000),
      ]);
      const orderBy = new Map<string, { count: number; last: string | null }>();
      for (const o of orders ?? []) {
        if (!o.customer_id) continue;
        const b = orderBy.get(o.customer_id) ?? { count: 0, last: null };
        b.count++; if (!b.last || o.order_date > b.last) b.last = o.order_date;
        orderBy.set(o.customer_id, b);
      }
      const ticketBy = new Map<string, number>();
      for (const t of tickets ?? []) {
        if (!t.customer_id) continue;
        ticketBy.set(t.customer_id, (ticketBy.get(t.customer_id) ?? 0) + 1);
      }
      const enriched = (customers ?? []).map((c: any) => {
        const o = orderBy.get(c.id);
        const days = o?.last ? Math.floor((Date.now() - new Date(o.last).getTime())/864e5) : 999;
        const tickets90 = ticketBy.get(c.id) ?? 0;
        let churnScore = 0;
        if (days > 90) churnScore += 40;
        else if (days > 60) churnScore += 25;
        else if (days > 30) churnScore += 10;
        if (!o) churnScore += 30;
        if (tickets90 >= 5) churnScore += 20;
        const health = churnScore >= 50 ? 'risk' : churnScore >= 25 ? 'watch' : 'healthy';
        const stage = !o ? 'onboarding' : o.count >= 5 ? 'expansion' : o.count >= 2 ? 'adopted' : 'activation';
        return { id: c.id, name: c.name, orders_90d: o?.count ?? 0, last_order: o?.last, tickets_90d: tickets90, churn_score: churnScore, health, stage };
      });
      enriched.sort((a, b) => b.churn_score - a.churn_score);
      return j({
        customers: enriched.slice(0, 100),
        totals: {
          count: enriched.length,
          risk: enriched.filter(c => c.health === 'risk').length,
          watch: enriched.filter(c => c.health === 'watch').length,
          healthy: enriched.filter(c => c.health === 'healthy').length,
        },
        stages: {
          onboarding: enriched.filter(c => c.stage === 'onboarding').length,
          activation: enriched.filter(c => c.stage === 'activation').length,
          adopted: enriched.filter(c => c.stage === 'adopted').length,
          expansion: enriched.filter(c => c.stage === 'expansion').length,
        },
      });
    }

    return j({ error: 'unknown action' }, 400);
  } catch (e: any) {
    return j({ error: e.message ?? 'error' }, 500);
  }
});
function j(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
