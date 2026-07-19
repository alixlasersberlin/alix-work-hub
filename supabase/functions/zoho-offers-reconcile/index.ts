// Reconcile Zoho estimates (Angebote) vs. local `offers` table.
// For each requested source_system (zoho_eu_1, zoho_eu_2 or both):
//   1. List ALL estimates from Zoho Books (paginated).
//   2. Compare against offers.offer_number (estimate_number + optional -AT suffix).
//   3. Return list of missing offers. If `import: true`, fetch each estimate
//      and upsert into `offers`.
//
// Auth: Bearer = SUPABASE_SERVICE_ROLE_KEY or CRON_SECRET.

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

function cfg(source: SourceSystem) {
  const orgPrefix = source === "zoho_eu_2" ? "ZOHO_EU_2" : "ZOHO_EU_1";
  return {
    clientId: Deno.env.get(`ZOHO_EU_1_CLIENT_ID`) ?? "",
    clientSecret: Deno.env.get(`ZOHO_EU_1_CLIENT_SECRET`) ?? "",
    refreshToken: Deno.env.get(`ZOHO_EU_1_REFRESH_TOKEN`) ?? "",
    organizationId: Deno.env.get(`${orgPrefix}_ORGANIZATION_ID`) ?? "",
    accountsBaseUrl: "https://accounts.zoho.eu",
    booksApiBaseUrl: "https://www.zohoapis.eu/books/v3",
  };
}

async function token(c: ReturnType<typeof cfg>) {
  const res = await fetch(`${c.accountsBaseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: c.refreshToken,
      client_id: c.clientId,
      client_secret: c.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Zoho token refresh failed: ${await res.text()}`);
  const j = await res.json();
  return j.access_token as string;
}

function statusMap(s: string): "draft" | "signed" | "order" {
  const v = (s ?? "").toLowerCase();
  if (v === "accepted" || v === "invoiced") return "order";
  if (v === "sent" || v === "viewed") return "signed";
  return "draft";
}

async function fetchAllEstimates(c: ReturnType<typeof cfg>, t: string, hardCapMs: number, startedAt: number) {
  const out: Array<{ estimate_id: string; estimate_number: string; date?: string; status?: string; customer_name?: string; total?: number }> = [];
  const perPage = 200;
  let page = 1;
  while (true) {
    if (Date.now() - startedAt > hardCapMs) break;
    const url = `${c.booksApiBaseUrl}/estimates?organization_id=${c.organizationId}&page=${page}&per_page=${perPage}&sort_column=created_time&sort_order=D`;
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${t}` } });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 2000)); continue; }
    if (!res.ok) throw new Error(`Zoho estimates list failed (page ${page}): ${await res.text()}`);
    const j = await res.json();
    const rows: any[] = Array.isArray(j.estimates) ? j.estimates : [];
    for (const r of rows) {
      out.push({
        estimate_id: String(r.estimate_id),
        estimate_number: String(r.estimate_number ?? ""),
        date: r.date, status: r.status, customer_name: r.customer_name, total: r.total,
      });
    }
    const hasMore = j.page_context?.has_more_page ?? (rows.length === perPage);
    if (!hasMore) break;
    page += 1;
  }
  return out;
}

async function loadLocalOfferNumbers(supabase: ReturnType<typeof createClient>, source: SourceSystem) {
  const nums = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  const suffix = source === "zoho_eu_2" ? "-AT" : "";
  while (true) {
    const { data, error } = await supabase.from("offers").select("offer_number").range(from, from + pageSize - 1);
    if (error) throw new Error(`offers query failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data as any[]) {
      const on = String(r.offer_number ?? "").toUpperCase();
      if (!on) continue;
      if (suffix) { if (on.endsWith(suffix)) nums.add(on); }
      else { if (!on.endsWith("-AT")) nums.add(on); }
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return nums;
}

async function importEstimate(admin: ReturnType<typeof createClient>, source: SourceSystem, c: ReturnType<typeof cfg>, t: string, est: { estimate_id: string; estimate_number: string; customer_name?: string }) {
  const suffix = source === "zoho_eu_2" ? "-AT" : "";
  const detRes = await fetch(`${c.booksApiBaseUrl}/estimates/${est.estimate_id}?organization_id=${c.organizationId}`, {
    headers: { Authorization: `Zoho-oauthtoken ${t}` },
  });
  if (!detRes.ok) throw new Error(`Estimate detail failed: ${detRes.status}`);
  const dj = await detRes.json();
  const full: any = dj.estimate ?? {};
  const offerNumber = `${est.estimate_number}${suffix}`;
  const net = Number(full.sub_total ?? 0);
  const tax = Number(full.tax_total ?? 0);
  const gross = Number(full.total ?? net + tax);

  let customerId: string | null = null;
  if (full.customer_id) {
    const { data: cust } = await admin
      .from("customers").select("id")
      .eq("source_system", source).eq("external_customer_id", String(full.customer_id))
      .maybeSingle();
    customerId = (cust as any)?.id ?? null;
  }

  const payload = {
    offerNumber,
    offerDate: full.date ?? null,
    validUntil: full.expiry_date ?? null,
    customer: { id: customerId, company_name: full.customer_name ?? est.customer_name ?? null, email: full.email ?? null, phone: full.phone ?? null },
    totals: { net, tax, gross },
    lines: (full.line_items ?? []).map((li: any) => ({
      sku: li.sku ?? null, name: li.name ?? li.description ?? null, description: li.description ?? null,
      quantity: Number(li.quantity ?? 0), unit_price: Number(li.rate ?? 0),
      tax_percent: Number(li.tax_percentage ?? 0), total: Number(li.item_total ?? 0),
    })),
    notes: full.notes ?? null,
    zoho: { source_system: source, estimate_id: est.estimate_id, estimate_number: est.estimate_number, status: full.status, reference_number: full.reference_number ?? null },
  };

  const row: any = {
    offer_number: offerNumber, offer_date: payload.offerDate, valid_until: payload.validUntil,
    customer_id: customerId, customer_name: full.customer_name ?? est.customer_name ?? null,
    customer_email: full.email ?? null, total_net: net, total_tax: tax, total_gross: gross,
    status: statusMap(full.status), payload,
    created_by_name: `Zoho ${source === "zoho_eu_2" ? "AT" : "DE"}`,
  };

  const { data: existing } = await admin.from("offers").select("id").eq("offer_number", offerNumber).maybeSingle();
  if (existing) {
    const { error } = await admin.from("offers").update(row).eq("offer_number", offerNumber);
    if (error) throw error;
  } else {
    const { error } = await admin.from("offers").insert(row);
    if (error) throw error;
  }
}

async function processSource(supabase: ReturnType<typeof createClient>, source: SourceSystem, doImport: boolean, hardCapMs: number, startedAt: number) {
  const c = cfg(source);
  if (!c.clientId || !c.refreshToken || !c.organizationId) {
    return { source, error: "Missing Zoho credentials/organization" };
  }
  const t = await token(c);
  const zoho = await fetchAllEstimates(c, t, hardCapMs, startedAt);
  const localNums = await loadLocalOfferNumbers(supabase, source);
  const suffix = source === "zoho_eu_2" ? "-AT" : "";

  const missing = zoho.filter((o) => !localNums.has(`${o.estimate_number}${suffix}`.toUpperCase()));

  const result: any = {
    source,
    zoho_total: zoho.length,
    local_total: localNums.size,
    missing_count: missing.length,
    missing: missing.slice(0, 500).map((m) => ({
      salesorder_id: m.estimate_id,
      salesorder_number: `${m.estimate_number}${suffix}`,
      date: m.date, status: m.status, customer_name: m.customer_name, total: m.total,
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
        await importEstimate(supabase, source, c, t, m);
        result.imported += 1;
      } catch (e) {
        result.failed += 1;
        result.import_errors.push({ id: m.estimate_id, number: `${m.estimate_number}${suffix}`, message: (e as Error).message });
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authHeader = req.headers.get("Authorization") ?? "";
  const tok = authHeader.replace(/^Bearer\s+/i, "").trim();
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  let authed = !!tok && (tok === cronSecret || tok === SERVICE_KEY);
  if (!authed && tok) {
    try {
      const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
      const uc = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: u } = await uc.auth.getUser(tok);
      if (u?.user) {
        const { data: isAdmin } = await uc.rpc("is_admin");
        authed = !!isAdmin;
      }
    } catch { /* ignore */ }
  }
  if (!authed) return json({ error: "Unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const requested: SourceSystem[] = Array.isArray(body.sources) && body.sources.length
    ? body.sources.filter((s: any) => s === "zoho_eu_1" || s === "zoho_eu_2")
    : ["zoho_eu_1", "zoho_eu_2"];
  const doImport = body.import === true;

  const startedAt = Date.now();
  const HARD_CAP_MS = Math.min(Math.max(Number(body.timeout_ms) || 240_000, 30_000), 280_000);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Targeted import: { source, estimate_ids: [...] } – skips the full listing.
  if (Array.isArray(body.estimate_ids) && body.estimate_ids.length && body.source) {
    const src: SourceSystem = body.source === "zoho_eu_2" ? "zoho_eu_2" : "zoho_eu_1";
    const c = cfg(src);
    if (!c.clientId || !c.refreshToken || !c.organizationId) {
      return json({ ok: false, error: "Missing Zoho credentials/organization" }, 500);
    }
    const t = await token(c);
    const out: any = { source: src, requested: body.estimate_ids.length, imported: 0, failed: 0, errors: [] as any[] };
    for (const id of body.estimate_ids as string[]) {
      try {
        await importEstimate(supabase, src, c, t, { estimate_id: String(id), estimate_number: "" });
        out.imported += 1;
      } catch (e) {
        out.failed += 1;
        out.errors.push({ id, message: (e as Error).message });
      }
    }
    return json({ ok: true, entity: "offers", targeted: true, duration_ms: Date.now() - startedAt, result: out });
  }

  const results: any[] = [];
  for (const src of requested) {
    try { results.push(await processSource(supabase, src, doImport, HARD_CAP_MS, startedAt)); }
    catch (e) { results.push({ source: src, error: (e as Error).message }); }
  }
  return json({ ok: true, entity: "offers", import: doImport, duration_ms: Date.now() - startedAt, results });
});
