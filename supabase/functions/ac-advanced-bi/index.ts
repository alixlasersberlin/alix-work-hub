import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Phase 42 — Advanced Analytics & BI. Cohort + LTV + custom KPI aggregates.
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
    const action = String(body.action ?? 'cohorts');

    if (action === 'cohorts') {
      const since = new Date(Date.now() - 365*864e5).toISOString();
      const { data: customers } = await supabase
        .from('customers').select('id, created_at').gte('created_at', since).limit(5000);
      const { data: orders } = await supabase
        .from('orders').select('customer_id, order_date, total').gte('order_date', since).limit(20000);
      const cohortMap = new Map<string, { size: number; ids: Set<string>; revenue: number }>();
      for (const c of customers ?? []) {
        const key = String(c.created_at).slice(0, 7);
        const b = cohortMap.get(key) ?? { size: 0, ids: new Set(), revenue: 0 };
        b.size++; b.ids.add(c.id); cohortMap.set(key, b);
      }
      for (const o of orders ?? []) {
        if (!o.customer_id) continue;
        for (const [, v] of cohortMap) if (v.ids.has(o.customer_id)) v.revenue += Number(o.total ?? 0);
      }
      const cohorts = Array.from(cohortMap.entries()).sort().map(([month, v]) => ({
        month, customers: v.size, revenue: Math.round(v.revenue*100)/100,
        ltv: v.size ? Math.round((v.revenue/v.size)*100)/100 : 0,
      }));
      const totalCust = cohorts.reduce((s, c) => s + c.customers, 0);
      const totalRev = cohorts.reduce((s, c) => s + c.revenue, 0);
      return j({
        cohorts,
        ltv_avg: totalCust ? Math.round((totalRev/totalCust)*100)/100 : 0,
        customers_total: totalCust,
        revenue_total: Math.round(totalRev*100)/100,
      });
    }

    if (action === 'kpi_summary') {
      const since30 = new Date(Date.now() - 30*864e5).toISOString();
      const [ord, tic, cus] = await Promise.all([
        supabase.from('orders').select('total, order_date').gte('order_date', since30).limit(5000),
        supabase.from('tickets').select('id, status').limit(5000),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
      ]);
      const rev = (ord.data ?? []).reduce((s: number, o: any) => s + Number(o.total ?? 0), 0);
      const open = (tic.data ?? []).filter((t: any) => t.status !== 'closed' && t.status !== 'resolved').length;
      return j({
        revenue_30d: Math.round(rev*100)/100,
        orders_30d: (ord.data ?? []).length,
        tickets_open: open,
        customers_total: cus.count ?? 0,
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
