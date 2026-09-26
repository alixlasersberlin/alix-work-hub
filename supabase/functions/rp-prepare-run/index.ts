import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Monatlicher Cron: bereitet den Lauf für den Folgemonat NUR als Vorschau vor.
// Idempotent je Periode; erzeugt keine Rechnungen, keine Lastschriften.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const d = new Date(); d.setUTCMonth(d.getUTCMonth() + 1);
  const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const { data, error } = await sb.rpc('rp_prepare_run', { p_period: period });
  return new Response(JSON.stringify({ period, run_id: data, error: error?.message ?? null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
