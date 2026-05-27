import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ZohoConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  organizationId: string;
  accountsBaseUrl: string;
  booksApiBaseUrl: string;
};

// ── Token cache ──
const tokenCache: Record<string, { token: string; expiresAt: number }> = {};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getZohoConfig(sourceSystem: string): ZohoConfig | null {
  const configs: Record<string, { prefix: string; accountsBase: string; apiBase: string }> = {
    zoho_eu_1: { prefix: "ZOHO_EU_1", accountsBase: "https://accounts.zoho.eu", apiBase: "https://www.zohoapis.eu/books/v3" },
    zoho_eu_2: { prefix: "ZOHO_EU_2", accountsBase: "https://accounts.zoho.eu", apiBase: "https://www.zohoapis.eu/books/v3" },
    zoho_us_1: { prefix: "ZOHO_US_1", accountsBase: "https://accounts.zoho.com", apiBase: "https://www.zohoapis.com/books/v3" },
  };
  const cfg = configs[sourceSystem];
  if (!cfg) return null;
  return {
    clientId: Deno.env.get(`${cfg.prefix}_CLIENT_ID`) ?? "",
    clientSecret: Deno.env.get(`${cfg.prefix}_CLIENT_SECRET`) ?? "",
    refreshToken: Deno.env.get(`${cfg.prefix}_REFRESH_TOKEN`) ?? "",
    organizationId: Deno.env.get(`${cfg.prefix}_ORGANIZATION_ID`) ?? "",
    accountsBaseUrl: cfg.accountsBase,
    booksApiBaseUrl: cfg.apiBase,
  };
}

async function getZohoAccessToken(config: ZohoConfig): Promise<string> {
  const cacheKey = `${config.clientId}_${config.organizationId}`;
  const cached = tokenCache[cacheKey];
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const retryDelays = [1500, 4000];
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    const response = await fetch(`${config.accountsBaseUrl}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: config.refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
      }),
    });
    const data = await response.json();
    if (typeof data.access_token === "string" && data.access_token.length > 0) {
      tokenCache[cacheKey] = { token: data.access_token, expiresAt: Date.now() + 50 * 60 * 1000 };
      return data.access_token;
    }
    const desc = String(data.error_description ?? "").toLowerCase();
    if (desc.includes("too many requests") || desc.includes("try again")) {
      if (attempt < retryDelays.length) { await sleep(retryDelays[attempt]); continue; }
    }
    throw new Error(`Token error: ${JSON.stringify(data)}`);
  }
  throw new Error("Could not obtain Zoho access token after retries");
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function hasCustomerChanged(
  existing: { company_name?: string | null; contact_name?: string | null; email?: string | null; phone?: string | null; billing_address?: unknown; shipping_address?: unknown },
  incoming: { company_name?: string | null; contact_name?: string | null; email?: string | null; phone?: string | null; billing_address?: unknown; shipping_address?: unknown },
): boolean {
  return (
    (existing.company_name ?? null) !== (incoming.company_name ?? null) ||
    (existing.contact_name ?? null) !== (incoming.contact_name ?? null) ||
    (existing.email ?? null) !== (incoming.email ?? null) ||
    (existing.phone ?? null) !== (incoming.phone ?? null) ||
    !jsonEqual(existing.billing_address, incoming.billing_address) ||
    !jsonEqual(existing.shipping_address, incoming.shipping_address)
  );
}

// ── Main handler ──
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: service role key, or authenticated admin user
    const authHeader = req.headers.get("Authorization") ?? "";
    const apiKeyHeader = req.headers.get("apikey") ?? "";
    const isServiceCall = authHeader === `Bearer ${serviceRoleKey}` || apiKeyHeader === serviceRoleKey;

    if (!isServiceCall) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await userClient.auth.getUser(token);
      const user = data?.user;
      console.log("[scheduled-sync] Auth check:", { hasToken: !!token, userId: user?.id, error: error?.message });
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: roles } = await adminClient.from("user_roles").select("roles!inner(name)").eq("user_id", user.id);
      const roleNames = (roles ?? []).map((r: any) => r.roles?.name).filter(Boolean);
      if (!roleNames.includes("Admin") && !roleNames.includes("Super Admin")) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Parse body for optional overrides
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* no body is fine */ }

    const sourceSystem = (body.source_system as string) ?? "zoho_eu_1";
    const zohoConfig = getZohoConfig(sourceSystem);
    if (!zohoConfig) {
      return new Response(JSON.stringify({ error: "Invalid source_system" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getZohoAccessToken(zohoConfig);

    // Calculate cutoff date for last_modified_time filter (default 1 day, configurable)
    const daysBack = Math.max(1, Math.min(365, Number(body.days_back ?? 1) || 1));
    const maxContacts = body.max_contacts != null ? Math.max(1, Number(body.max_contacts)) : null;
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - daysBack);
    cutoff.setHours(0, 0, 0, 0);
    // Zoho Books requires ISO8601 datetime, e.g. 2026-05-13T00:00:00+0000
    const lastModifiedAfter = cutoff.toISOString().replace(/\.\d{3}Z$/, "+0000");

    console.log(`[scheduled-sync] Starting sync for ${sourceSystem}, modified since ${lastModifiedAfter}`);

    let page = 1;
    let totalImported = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let totalFetched = 0;
    const errors: { id: string; message: string }[] = [];
    const MAX_PAGES = 50; // safety limit

    while (page <= MAX_PAGES) {
      const apiUrl = `${zohoConfig.booksApiBaseUrl}/contacts?organization_id=${zohoConfig.organizationId}&page=${page}&per_page=200&last_modified_time=${encodeURIComponent(lastModifiedAfter)}`;

      console.log(`[scheduled-sync] Fetching page ${page}: ${apiUrl}`);

      const res = await fetch(apiUrl, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`[scheduled-sync] Zoho API error page ${page}: ${text}`);
        break;
      }

      const json = await res.json();
      const contacts = json.contacts ?? [];
      const hasMore = json.page_context?.has_more_page === true;

      console.log(`[scheduled-sync] Page ${page}: ${contacts.length} contacts, hasMore=${hasMore}`);

      if (contacts.length === 0) break;

      totalFetched += contacts.length;

      for (const contact of contacts) {
        if (maxContacts != null && (totalImported + totalUpdated + totalSkipped + totalFailed) >= maxContacts) break;
        const externalId = contact.contact_id?.toString();
        if (!externalId) { totalSkipped++; continue; }

        try {
          // Fetch detail for addresses
          let contactDetail = contact;
          try {
            const detailRes = await fetch(
              `${zohoConfig.booksApiBaseUrl}/contacts/${externalId}?organization_id=${zohoConfig.organizationId}`,
              { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
            );
            if (detailRes.ok) {
              const detailJson = await detailRes.json();
              if (detailJson.contact) contactDetail = detailJson.contact;
            }
          } catch (e: any) {
            console.warn(`[scheduled-sync] Detail fetch failed for ${externalId}: ${e?.message}`);
          }

          const payload = {
            external_customer_id: externalId,
            source_system: sourceSystem,
            company_name: contactDetail.company_name ?? null,
            contact_name: contactDetail.contact_name ?? null,
            email: contactDetail.email ?? null,
            phone: contactDetail.mobile || contactDetail.phone || null,
            billing_address: contactDetail.billing_address ?? null,
            shipping_address: contactDetail.shipping_address ?? null,
            raw_data: contactDetail,
          };

          const { data: existing } = await adminClient
            .from("customers")
            .select("id, company_name, contact_name, email, phone, billing_address, shipping_address")
            .eq("external_customer_id", externalId)
            .eq("source_system", sourceSystem)
            .maybeSingle();

          if (existing) {
            if (!hasCustomerChanged(existing, payload)) {
              totalSkipped++;
            } else {
              const { error: updateErr } = await adminClient.from("customers").update({
                company_name: payload.company_name,
                contact_name: payload.contact_name,
                email: payload.email,
                phone: payload.phone,
                billing_address: payload.billing_address,
                shipping_address: payload.shipping_address,
                raw_data: payload.raw_data,
              }).eq("id", existing.id);
              if (updateErr) {
                totalFailed++;
                errors.push({ id: externalId, message: updateErr.message });
              } else {
                totalUpdated++;
              }
            }
          } else {
            const { error: insertErr } = await adminClient.from("customers").insert(payload);
            if (insertErr) {
              totalFailed++;
              errors.push({ id: externalId, message: insertErr.message });
            } else {
              totalImported++;
            }
          }
        } catch (err: any) {
          totalFailed++;
          errors.push({ id: externalId, message: err?.message ?? "Unknown" });
        }

        // Small delay between detail fetches to avoid rate limits
        await sleep(100);
      }

      if (maxContacts != null && (totalImported + totalUpdated + totalSkipped + totalFailed) >= maxContacts) break;
      if (!hasMore) break;
      page++;

      // Delay between pages to avoid Zoho rate limits
      await sleep(500);
    }

    const durationMs = Date.now() - startTime;

    // Audit log
    await adminClient.from("audit_logs").insert({
      user_id: null,
      action: "scheduled_customer_sync",
      module: "import_management",
      details: {
        source_system: sourceSystem,
        modified_since: lastModifiedAfter,
        pages_processed: page,
        total_fetched: totalFetched,
        imported: totalImported,
        updated: totalUpdated,
        skipped: totalSkipped,
        failed: totalFailed,
        duration_ms: durationMs,
        error_count: errors.length,
      },
    });

    const result = {
      success: true,
      source_system: sourceSystem,
      modified_since: lastModifiedAfter,
      pages_processed: page,
      total_fetched: totalFetched,
      imported: totalImported,
      updated: totalUpdated,
      skipped: totalSkipped,
      failed: totalFailed,
      duration_ms: durationMs,
      ...(errors.length > 0 ? { errors: errors.slice(0, 20) } : {}),
    };

    console.log(`[scheduled-sync] Done:`, JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[scheduled-sync] Fatal error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
