// One-off: imports ALL Alix Austria (zoho_eu_2) customers.
// Note: customer number -AT suffix is UI-only (DB stays clean).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Auth guard: require CRON_SECRET bearer or service-role key
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  if (!token || (token !== cronSecret && token !== SERVICE_KEY)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const t0 = Date.now();
  const runs: any[] = [];
  let totalImported = 0, totalUpdated = 0, totalSkipped = 0, totalFailed = 0;
  const HARD_LIMIT_MS = 250_000;

  // Loop in case the underlying function paginates per invocation
  for (let i = 0; i < 20; i++) {
    if (Date.now() - t0 > HARD_LIMIT_MS) break;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/scheduled-customer-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({ source_system: 'zoho_eu_2', days_back: 3650, max_contacts: 10000 }),
    });
    const j = await res.json().catch(() => ({}));
    runs.push({ iter: i + 1, status: res.status, ...j });
    if (!res.ok) break;
    totalImported += j.imported ?? 0;
    totalUpdated  += j.updated ?? 0;
    totalSkipped  += j.skipped ?? 0;
    totalFailed   += j.failed ?? 0;
    // single full pass is enough; stop after first run
    break;
  }

  return new Response(JSON.stringify({
    success: true,
    totals: { imported: totalImported, updated: totalUpdated, skipped: totalSkipped, failed: totalFailed },
    duration_ms: Date.now() - t0,
    runs,
  }, null, 2), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
