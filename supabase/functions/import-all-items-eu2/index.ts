// One-off: imports ALL Alix Austria (zoho_eu_2) items by paging until has_more=false.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  if (!token || (token !== cronSecret && token !== SERVICE_KEY)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const runs: any[] = [];
  let page = 1;
  let totalImported = 0, totalUpdated = 0, totalFailed = 0, totalProcessed = 0;
  const t0 = Date.now();
  const HARD_LIMIT_MS = 250_000;

  for (let i = 0; i < 200; i++) {
    if (Date.now() - t0 > HARD_LIMIT_MS) break;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-zoho-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({ source_system: 'zoho_eu_2', page, per_page: 200, max_pages: 30 }),
    });
    const j = await res.json().catch(() => ({}));
    runs.push({ page_start: page, status: res.status, ...j });
    if (!res.ok) break;
    totalImported += j.imported ?? 0;
    totalUpdated  += j.updated ?? 0;
    totalFailed   += j.failed ?? 0;
    totalProcessed += j.processed ?? 0;
    if (!j.has_more) break;
    page = (j.last_page ?? page) + 1;
  }

  return new Response(JSON.stringify({
    success: true,
    totals: { imported: totalImported, updated: totalUpdated, failed: totalFailed, processed: totalProcessed },
    duration_ms: Date.now() - t0,
    runs,
  }, null, 2), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
