// Scheduled wrapper: runs daily at 23:45 (via pg_cron) and chains
// calls to sync-zoho-recurring-invoices until all profile pages are processed.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }

  const sourceSystem = (body.source_system as string) ?? "zoho_eu_1";
  const dateFrom = (body.date_from as string) ?? "2025-01-01";
  let page = (body.page as number) ?? 1;

  const totals = { imported: 0, updated: 0, failed: 0, profiles_processed: 0, pages: 0 };
  const startedAt = Date.now();
  const HARD_DEADLINE_MS = 300_000; // chain within 5 min, otherwise self-invoke async

  while (true) {
    if (Date.now() - startedAt > HARD_DEADLINE_MS) {
      // Fire-and-forget continuation
      fetch(`${supabaseUrl}/functions/v1/scheduled-recurring-invoice-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
        body: JSON.stringify({ source_system: sourceSystem, date_from: dateFrom, page }),
      }).catch(() => {});
      return new Response(JSON.stringify({ ...totals, continued_at_page: page }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/sync-zoho-recurring-invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      body: JSON.stringify({ source_system: sourceSystem, date_from: dateFrom, page, max_pages: 1, per_page: 50 }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error(`[scheduled-recurring-invoice-sync] page ${page} failed: ${t}`);
      return new Response(JSON.stringify({ error: t, ...totals, last_page: page }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    totals.imported += data.imported ?? 0;
    totals.updated += data.updated ?? 0;
    totals.failed += data.failed ?? 0;
    totals.profiles_processed += data.profiles_processed ?? 0;
    totals.pages += 1;

    if (!data.profiles_have_more) {
      return new Response(JSON.stringify({ success: true, ...totals }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    page = (data.last_profile_page ?? page) + 1;
  }
});
