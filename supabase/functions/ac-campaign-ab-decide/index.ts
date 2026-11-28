import { requireCallerAccess } from '../_shared/caller-access.ts';
import { z } from 'npm:zod@3.25.76';

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    const access = await requireCallerAccess(req, corsHeaders, ['Admin', 'Super Admin']);
    if ('response' in access) return access.response;
    const sb = access.caller;
    const supabase = sb;
    const parsedBody = z.object({ campaign_id: z.string().uuid() }).strict().safeParse(await req.json().catch(() => null));
    if (!parsedBody.success) return new Response(JSON.stringify({ error: 'Invalid campaign_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { campaign_id } = parsedBody.data;
    if (!campaign_id) throw new Error('campaign_id required');

    const { data: camp, error: e1 } = await supabase.from('ac_campaigns')
      .select('*').eq('id', campaign_id).single();
    if (e1 || !camp) return new Response(JSON.stringify({ error: 'Campaign not found in authorized scope' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!camp?.is_ab_test) throw new Error('Not an A/B test');

    const metric = (camp.winner_metric ?? 'open_rate') as string;
    const { data: recips } = await supabase.from('ac_campaign_recipients')
      .select('*').eq('campaign_id', campaign_id);

    const agg: Record<string, { total: number; hit: number }> = {};
    for (const r of recips ?? []) {
      const v = (r as any).variant ?? (r as any).ab_variant ?? 'A';
      agg[v] ??= { total: 0, hit: 0 };
      agg[v].total++;
      const meta = ((r as any).metadata ?? {}) as any;
      const hit =
        metric === 'open_rate' ? !!(r as any).opened_at :
        metric === 'click_rate' ? !!(r as any).clicked_at :
        metric === 'reply_rate' ? !!(r as any).replied_at :
        !!(meta.converted ?? (r as any).converted_at);
      if (hit) agg[v].hit++;
    }

    const scored = Object.entries(agg).map(([k, v]) => ({ key: k, rate: v.total ? v.hit / v.total : 0, ...v }));
    scored.sort((a, b) => b.rate - a.rate);
    const winner = scored[0]?.key ?? null;

    await supabase.from('ac_campaigns').update({
      ab_variants: { ...(camp.ab_variants ?? {}), results: scored, winner },
    }).eq('id', campaign_id);

    return new Response(JSON.stringify({ success: true, winner, metric, results: scored }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
