// Cron: alle 15 Min. Markiert überfällige Tickets & eskaliert.
import { createClient } from 'npm:@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data, error } = await sb.rpc('ticket_sla_check_and_escalate');
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, result: data }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
