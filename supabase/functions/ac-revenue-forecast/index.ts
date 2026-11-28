import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCallerAccess } from '../_shared/caller-access.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  const access = await requireCallerAccess(req, corsHeaders, ['Super Admin', 'Admin']);
  if ('response' in access) return access.response;

  try {
    const supabase = access.caller;
    const body = await req.json().catch(() => ({}));
    const model = body.model ?? 'linear';
    const days = Number(body.days ?? 90);
    if (!Number.isInteger(days) || days < 1 || days > 366 || typeof model !== 'string' || !/^[a-z_]{1,30}$/.test(model)) return new Response('Invalid forecast input', { status: 400, headers: corsHeaders });
    const customerIds: string[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data: customers, error: customerError } = await supabase.from('customers').select('id').in('source_system', access.tenants.map((t: any) => t.zoho_source_system).filter(Boolean)).order('id').range(offset, offset + 499);
      if (customerError) throw customerError;
      customerIds.push(...(customers ?? []).map((c: any) => c.id));
      if (!customers || customers.length < 500) break;
    }

    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const data: any[] = [];
    for (let start = 0; start < customerIds.length; start += 100) {
      for (let offset = 0; ; offset += 500) {
        const { data: rows, error } = await supabase.from('ac_revenue_attributions')
          .select('id, order_date, attributed_amount').eq('model', model).in('customer_id', customerIds.slice(start, start + 100))
          .gte('order_date', since).order('id').range(offset, offset + 499);
        if (error) throw error;
        data.push(...(rows ?? []));
        if (!rows || rows.length < 500) break;
      }
    }
    data.sort((a, b) => String(a.order_date).localeCompare(String(b.order_date)));

    // Daily bucket
    const buckets = new Map<string, number>();
    for (const r of data ?? []) {
      const d = new Date(r.order_date as any).toISOString().slice(0, 10);
      buckets.set(d, (buckets.get(d) ?? 0) + Number(r.attributed_amount || 0));
    }
    const daily = [...buckets.values()];
    const avg = daily.length ? daily.reduce((s, v) => s + v, 0) / daily.length : 0;

    // Linear regression slope for trend
    const n = daily.length;
    let slope = 0;
    if (n >= 2) {
      const xMean = (n - 1) / 2;
      const yMean = avg;
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) { num += (i - xMean) * (daily[i] - yMean); den += (i - xMean) ** 2; }
      slope = den ? num / den : 0;
    }

    const proj = (horizon: number) => {
      let sum = 0;
      for (let i = 1; i <= horizon; i++) sum += Math.max(0, avg + slope * (n + i));
      return Math.round(sum);
    };

    return new Response(JSON.stringify({
      model, days, samples: n, daily_avg: Math.round(avg), slope,
      trend: slope > avg * 0.02 ? 'up' : slope < -avg * 0.02 ? 'down' : 'flat',
      forecast_30: proj(30), forecast_60: proj(60), forecast_90: proj(90),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
