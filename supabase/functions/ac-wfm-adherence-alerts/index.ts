// Prüft Live-Adherence; erzeugt app_notifications, wenn ein Agent < 80 % über die letzten 15 Min ist.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: rows } = await sb.rpc('ac_wfm_adherence_live');
    const low = (rows ?? []).filter((r: any) => Number(r.adherence_pct ?? 100) < 80 && Number(r.scheduled_minutes ?? 0) >= 15);
    let created = 0;
    for (const r of low) {
      // Dedupe: nur 1 Notification pro Agent pro 60 min
      const { data: existing } = await sb.from('app_notifications')
        .select('id').eq('user_id', r.agent_id).eq('kind', 'wfm_adherence_low')
        .gte('created_at', new Date(Date.now() - 3600_000).toISOString()).limit(1);
      if (existing?.length) continue;
      await sb.from('app_notifications').insert({
        user_id: r.agent_id,
        kind: 'wfm_adherence_low',
        title: `Adherence niedrig: ${r.adherence_pct}%`,
        body: `Ist ${r.actual_minutes} von ${r.scheduled_minutes} min – bitte online bleiben oder Pause abmelden.`,
        severity: 'warning',
        link: '/alix-connect/wfm',
      });
      created++;
    }
    return new Response(JSON.stringify({ ok: true, checked: rows?.length ?? 0, alerts: created }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
