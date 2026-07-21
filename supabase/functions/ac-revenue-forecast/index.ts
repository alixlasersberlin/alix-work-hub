import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const body = await req.json().catch(() => ({}));
    const model = body.model ?? 'linear';
    const days = Number(body.days ?? 90);

    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data, error } = await supabase.from('ac_revenue_attributions')
      .select('order_date, attributed_amount').eq('model', model)
      .gte('order_date', since).order('order_date', { ascending: true }).limit(10000);
    if (error) throw error;

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
