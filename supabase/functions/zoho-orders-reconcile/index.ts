// Reconcile Zoho sales orders vs. local `orders` table.
// For each requested source_system (zoho_eu_1, zoho_eu_2 or both):
//   1. List ALL salesorders from Zoho Books (paginated).
//   2. Compare against orders.external_order_id where source_system matches.
//   3. Return the list of missing orders. If `import: true`, invoke
//      sync-single-order for each missing salesorder (bounded by time).
//
// Auth: requires Bearer = SUPABASE_SERVICE_ROLE_KEY or CRON_SECRET.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type SourceSystem = "zoho_eu_1" | "zoho_eu_2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getZohoConfig(sourceSystem: SourceSystem) {
  const prefix = sourceSystem === "zoho_eu_2" ? "ZOHO_EU_1" : "ZOHO_EU_1"; // shared OAuth app for EU
  const orgPrefix = sourceSystem === "zoho_eu_2" ? "ZOHO_EU_2" : "ZOHO_EU_1";
  return {
    clientId: Deno.env.get(`${prefix}_CLIENT_ID`) ?? "",
    clientSecret: Deno.env.get(`${prefix}_CLIENT_SECRET`) ?? "",
    refreshToken: Deno.env.get(`${prefix}_REFRESH_TOKEN`) ?? "",
    organizationId: Deno.env.get(`${orgPrefix}_ORGANIZATION_ID`) ?? "",
    accountsBaseUrl: "https://accounts.zoho.eu",
    booksApiBaseUrl: "https://www.zohoapis.eu/books/v3",
  };
}

async function getAccessToken(cfg: ReturnType<typeof getZohoConfig>) {
  const res = await fetch(`${cfg.accountsBaseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: cfg.refreshToken,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Zoho token refresh failed: ${await res.text()}`);
  const j = await res.json();
  if (!j.access_token) throw new Error("Zoho access token missing");
  return j.access_token as string;
}

async function fetchAllZohoSalesOrders(cfg: ReturnType<typeof getZohoConfig>, token: string, hardCapMs: number, startedAt: number) {
  const out: Array<{ salesorder_id: string; salesorder_number: string; date?: string; status?: string; customer_name?: string; total?: number }> = [];
  const perPage = 200;
  let page = 1;
  while (true) {
    if (Date.now() - startedAt > hardCapMs) break;
    const url = `${cfg.booksApiBaseUrl}/salesorders?organization_id=${cfg.organizationId}&page=${page}&per_page=${perPage}&sort_column=created_time&sort_order=D`;
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 2000)); continue; }
    if (!res.ok) throw new Error(`Zoho salesorders list failed (page ${page}): ${await res.text()}`);
    const j = await res.json();
    const rows: any[] = Array.isArray(j.salesorders) ? j.salesorders : [];
    for (const r of rows) {
      out.push({
        salesorder_id: String(r.salesorder_id),
        salesorder_number: String(r.salesorder_number ?? ""),
        date: r.date,
        status: r.status,
        customer_name: r.customer_name,
        total: r.total,
      });
    }
    const hasMore = j.page_context?.has_more_page ?? (rows.length === perPage);
    if (!hasMore) break;
    page += 1;
  }
  return out;
}

async function loadLocalExternalIds(supabase: ReturnType<typeof createClient>, source: SourceSystem) {
  const ids = new Set<string>();
  const nums = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("orders")
      .select("external_order_id, order_number")
      .eq("source_system", source)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`orders query failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data as any[]) {
      if (r.external_order_id) ids.add(String(r.external_order_id));
      if (r.order_number) nums.add(String(r.order_number).toUpperCase());
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { ids, nums };
}

async function importOne(source: SourceSystem, external_order_id: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-single-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({ source_system: source, external_order_id }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function processSource(
  supabase: ReturnType<typeof createClient>,
  source: SourceSystem,
  doImport: boolean,
  hardCapMs: number,
  startedAt: number,
) {
  const cfg = getZohoConfig(source);
  if (!cfg.clientId || !cfg.refreshToken || !cfg.organizationId) {
    return { source, error: "Missing Zoho credentials/organization" };
  }
  const token = await getAccessToken(cfg);
  const zohoOrders = await fetchAllZohoSalesOrders(cfg, token, hardCapMs, startedAt);
  const local = await loadLocalExternalIds(supabase, source);

  const missing = zohoOrders.filter((o) =>
    !local.ids.has(o.salesorder_id) && !local.nums.has(o.salesorder_number.toUpperCase())
  );

  // Determine which of the missing salesorders are NEW (not yet tracked in orders_missing)
  const newlyDiscovered: typeof missing = [];
  if (missing.length) {
    const missingIds = missing.map((m) => m.salesorder_id);
    const existingIds = new Set<string>();
    for (let i = 0; i < missingIds.length; i += 500) {
      const chunk = missingIds.slice(i, i + 500);
      const { data: existing } = await supabase
        .from("orders_missing")
        .select("external_order_id")
        .eq("source_system", source)
        .in("external_order_id", chunk);
      (existing as any[] | null)?.forEach((r) => existingIds.add(String(r.external_order_id)));
    }
    for (const m of missing) {
      if (!existingIds.has(m.salesorder_id)) newlyDiscovered.push(m);
    }

    const rows = missing.map((m) => ({
      source_system: source,
      external_order_id: m.salesorder_id,
      order_number: m.salesorder_number || null,
      zoho_date: m.date || null,
      zoho_status: m.status || null,
      customer_name: m.customer_name || null,
      total: typeof m.total === "number" ? m.total : null,
      last_seen_at: new Date().toISOString(),
      import_status: "pending",
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase
        .from("orders_missing")
        .upsert(chunk, { onConflict: "source_system,external_order_id", ignoreDuplicates: false });
      if (error) console.error("orders_missing upsert error", error.message);
    }
  }


  // Mark any previously-missing rows that are now present in local orders as resolved
  const localAll = Array.from(local.ids);
  if (localAll.length) {
    for (let i = 0; i < localAll.length; i += 500) {
      const chunk = localAll.slice(i, i + 500);
      await supabase
        .from("orders_missing")
        .update({ import_status: "resolved", resolved_at: new Date().toISOString() })
        .eq("source_system", source)
        .in("external_order_id", chunk)
        .neq("import_status", "resolved");
    }
  }

  const result: any = {
    source,
    zoho_total: zohoOrders.length,
    local_total: local.ids.size,
    missing_count: missing.length,
    newly_discovered: newlyDiscovered.map((m) => ({
      source_system: source,
      external_order_id: m.salesorder_id,
      order_number: m.salesorder_number,
      customer_name: m.customer_name,
      zoho_date: m.date,
      zoho_status: m.status,
      total: m.total,
    })),
    missing: missing.slice(0, 500).map((m) => ({
      salesorder_id: m.salesorder_id,
      salesorder_number: m.salesorder_number,
      date: m.date,
      status: m.status,
      customer_name: m.customer_name,
      total: m.total,
    })),
    imported: 0,
    failed: 0,
    import_errors: [] as Array<{ id: string; number: string; message: string }>,
    truncated: false,
  };


  if (doImport && missing.length) {
    for (const m of missing) {
      if (Date.now() - startedAt > hardCapMs) { result.truncated = true; break; }
      try {
        const r = await importOne(source, m.salesorder_id);
        if (r.ok) {
          result.imported += 1;
          await supabase.from("orders_missing").update({
            import_status: "imported",
            imported_at: new Date().toISOString(),
            resolved_at: new Date().toISOString(),
            import_error: null,
          }).eq("source_system", source).eq("external_order_id", m.salesorder_id);
        } else {
          result.failed += 1;
          const msg = (r.body as any)?.message || (r.body as any)?.error || `HTTP ${r.status}`;
          result.import_errors.push({ id: m.salesorder_id, number: m.salesorder_number, message: msg });
          await supabase.from("orders_missing").update({
            import_status: "failed",
            import_error: msg,
          }).eq("source_system", source).eq("external_order_id", m.salesorder_id);
        }
      } catch (e) {
        result.failed += 1;
        const msg = (e as Error).message;
        result.import_errors.push({ id: m.salesorder_id, number: m.salesorder_number, message: msg });
        await supabase.from("orders_missing").update({
          import_status: "failed",
          import_error: msg,
        }).eq("source_system", source).eq("external_order_id", m.salesorder_id);
      }
      // gentle pacing to avoid Zoho rate limits
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: service key, CRON_SECRET, or authenticated Admin/Super Admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  let authed = !!token && (token === cronSecret || token === SERVICE_KEY);
  if (!authed && token) {
    try {
      const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: u } = await userClient.auth.getUser(token);
      if (u?.user) {
        const { data: isAdmin } = await userClient.rpc("is_admin");
        authed = !!isAdmin;
      }
    } catch { /* ignore */ }
  }
  if (!authed) return json({ error: "Unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* GET / empty */ }

  const requested: SourceSystem[] = Array.isArray(body.sources) && body.sources.length
    ? body.sources.filter((s: any) => s === "zoho_eu_1" || s === "zoho_eu_2")
    : ["zoho_eu_1", "zoho_eu_2"];
  const doImport = body.import === true;

  const startedAt = Date.now();
  const HARD_CAP_MS = Math.min(Math.max(Number(body.timeout_ms) || 240_000, 30_000), 280_000);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const results: any[] = [];
  for (const src of requested) {
    try {
      results.push(await processSource(supabase, src, doImport, HARD_CAP_MS, startedAt));
    } catch (e) {
      results.push({ source: src, error: (e as Error).message });
    }
  }

  // Aggregate newly discovered across all sources and notify
  const allNew: any[] = [];
  for (const r of results) {
    if (Array.isArray(r?.newly_discovered)) allNew.push(...r.newly_discovered);
  }
  if (allNew.length > 0) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
        },
        body: JSON.stringify({
          templateName: "orders-missing-alert",
          recipientEmail: "natalia.p@alix-operation.de",
          extraCc: ["k.trinh@alix-operation.de"],
          skipDefaultCopies: true,
          idempotencyKey: `orders-missing-${new Date().toISOString().slice(0,16)}`,
          templateData: {
            count: allNew.length,
            orders: allNew,
            portalUrl: "https://app.alixwork.de/auftraege/gesucht",
          },
        }),
      });
      if (!resp.ok) console.error("orders-missing-alert send failed:", await resp.text());
    } catch (e) {
      console.error("orders-missing-alert send error:", (e as Error).message);
    }
  }

  return json({
    ok: true,
    import: doImport,
    duration_ms: Date.now() - startedAt,
    newly_discovered_count: allNew.length,
    results,
  });
});
