// ALIX CONNECT — Phase 26 Revenue Attribution
// Rechnet Aufträge auf Touchpoints/Kanäle zu (First/Last/Linear/Time-Decay/Position-Based)
// und schreibt Ergebnisse nach ac_revenue_attributions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODELS = ['first', 'last', 'linear', 'time_decay', 'position'] as const;
type Model = typeof MODELS[number];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const days = Math.min(Number(body?.days ?? 90), 365);
    const modelsSel: Model[] = Array.isArray(body?.models) ? body.models : (MODELS as unknown as Model[]);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data: orders } = await sb.from('orders').select('id, customer_id, order_total, currency, created_at').gte('created_at', since).limit(5000);
    if (!orders?.length) return json({ ok: true, orders: 0 });

    // Reset window
    await sb.from('ac_revenue_attributions').delete().gte('order_date', since);

    const inserts: any[] = [];
    for (const o of orders) {
      const amount = Number(o.order_total ?? 0);
      if (!amount || !o.customer_id) continue;
      const cutoff = new Date(new Date(o.created_at as any).getTime() - 60 * 86_400_000).toISOString();

      // touchpoints from ac_messages + ac_calls + ac_analytics_events
      const [{ data: msgs }, { data: calls }, { data: evts }] = await Promise.all([
        sb.from('ac_messages').select('id, channel, created_at').eq('customer_id', o.customer_id).gte('created_at', cutoff).lte('created_at', o.created_at).order('created_at').limit(200),
        sb.from('ac_calls').select('id, direction, created_at').eq('customer_id', o.customer_id).gte('created_at', cutoff).lte('created_at', o.created_at).order('created_at').limit(200),
        sb.from('ac_analytics_events').select('id, channel, created_at').eq('customer_id', o.customer_id).gte('created_at', cutoff).lte('created_at', o.created_at).order('created_at').limit(200),
      ]);

      const tps: Array<{ id: string, channel: string, at: string }> = [];
      (msgs ?? []).forEach((m: any) => tps.push({ id: m.id, channel: m.channel || 'message', at: m.created_at }));
      (calls ?? []).forEach((c: any) => tps.push({ id: c.id, channel: 'call', at: c.created_at }));
      (evts ?? []).forEach((e: any) => tps.push({ id: e.id, channel: e.channel || 'web', at: e.created_at }));
      tps.sort((a, b) => a.at.localeCompare(b.at));
      if (!tps.length) continue;

      for (const model of modelsSel) {
        const weights = computeWeights(model, tps, o.created_at as string);
        tps.forEach((tp, i) => {
          const w = weights[i] || 0;
          if (w <= 0) return;
          inserts.push({
            order_id: o.id,
            customer_id: o.customer_id,
            amount,
            currency: o.currency ?? 'EUR',
            order_date: o.created_at,
            model,
            channel: tp.channel,
            touchpoint_id: tp.id,
            weight: w,
            attributed_amount: +(amount * w).toFixed(2),
          });
        });
      }
    }

    // Chunked insert
    for (let i = 0; i < inserts.length; i += 500) {
      const { error } = await sb.from('ac_revenue_attributions').insert(inserts.slice(i, i + 500));
      if (error) throw error;
    }

    return json({ ok: true, orders: orders.length, rows: inserts.length });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});

function computeWeights(model: Model, tps: Array<{ at: string }>, orderAt: string): number[] {
  const n = tps.length;
  if (n === 0) return [];
  if (model === 'first') { const w = new Array(n).fill(0); w[0] = 1; return w; }
  if (model === 'last') { const w = new Array(n).fill(0); w[n - 1] = 1; return w; }
  if (model === 'linear') return new Array(n).fill(1 / n);
  if (model === 'position') {
    if (n === 1) return [1];
    if (n === 2) return [0.5, 0.5];
    const w = new Array(n).fill(0.2 / (n - 2));
    w[0] = 0.4; w[n - 1] = 0.4;
    return w;
  }
  // time_decay: half-life 7 days back from order
  const halflife = 7 * 86_400_000;
  const oT = new Date(orderAt).getTime();
  const raw = tps.map(t => Math.pow(0.5, (oT - new Date(t.at).getTime()) / halflife));
  const sum = raw.reduce((s, x) => s + x, 0) || 1;
  return raw.map(x => x / sum);
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
