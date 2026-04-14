import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ImportPayload = {
  source_system: "zoho_eu_1" | "zoho_eu_2" | "zoho_us_1";
  mode?: "manual" | "scheduled" | "dry_run";
  entity?: "contacts" | "salesorders";
  page?: number;
  job_id?: string;
  date_from?: string;
  date_to?: string;
  status_filter?: string;
  customer_name?: string;
  search_text?: string;
  sort_column?: string;
  sort_order?: "ascending" | "descending";
};

type ZohoConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  organizationId: string;
  accountsBaseUrl: string;
  booksApiBaseUrl: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
  if (!data.access_token) {
    if (data.error === "invalid_code") {
      throw new Error("Zoho refresh token is invalid or revoked.");
    }
    throw new Error(`Zoho access token missing: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
}

// ── Main handler: processes ONE page of ONE entity per call ──
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Missing server configuration" }, 500);
    }
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    // Auth check
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: callerRoles } = await adminClient
      .from("user_roles").select("roles!inner(name)").eq("user_id", user.id);
    const roleNames = (callerRoles ?? []).map((row: any) => row.roles?.name).filter(Boolean);
    const isAdmin = roleNames.includes("Admin") || roleNames.includes("Super Admin");
    if (!isAdmin) return jsonResponse({ error: "Forbidden" }, 403);

    const body = (await req.json()) as ImportPayload;
    const sourceSystem = body.source_system;
    const mode = body.mode ?? "manual";
    const isDryRun = mode === "dry_run";
    const entity = body.entity ?? "contacts"; // "contacts" or "salesorders"
    const page = body.page ?? 1;

    // Validate
    const allowedSources = ["zoho_eu_1", "zoho_eu_2", "zoho_us_1"];
    if (!allowedSources.includes(sourceSystem)) {
      return jsonResponse({ error: "Invalid source_system" }, 400);
    }
    if (body.date_from && !isValidDate(body.date_from)) {
      return jsonResponse({ error: "Ungültiges Startdatum (YYYY-MM-DD)" }, 400);
    }
    if (body.date_to && !isValidDate(body.date_to)) {
      return jsonResponse({ error: "Ungültiges Enddatum (YYYY-MM-DD)" }, 400);
    }

    const zohoConfig = getZohoConfig(sourceSystem);
    if (!zohoConfig) return jsonResponse({ error: "Zoho configuration not found" }, 500);

    const accessToken = await getZohoAccessToken(zohoConfig);

    // Build URL for the entity
    let apiUrl: string;
    let apiKey: string;

    if (entity === "contacts") {
      apiUrl = `${zohoConfig.booksApiBaseUrl}/contacts?organization_id=${zohoConfig.organizationId}&page=${page}&per_page=200`;
      apiKey = "contacts";
    } else {
      apiUrl = `${zohoConfig.booksApiBaseUrl}/salesorders?organization_id=${zohoConfig.organizationId}&page=${page}&per_page=200`;
      if (body.date_from) apiUrl += `&date_start=${body.date_from}`;
      if (body.date_to) apiUrl += `&date_end=${body.date_to}`;
      if (body.status_filter) apiUrl += `&status=${encodeURIComponent(body.status_filter)}`;
      if (body.customer_name) apiUrl += `&customer_name=${encodeURIComponent(body.customer_name)}`;
      if (body.search_text) apiUrl += `&search_text=${encodeURIComponent(body.search_text)}`;
      if (body.sort_column) apiUrl += `&sort_column=${encodeURIComponent(body.sort_column)}`;
      if (body.sort_order) apiUrl += `&sort_order=${body.sort_order === "ascending" ? "A" : "D"}`;
      apiKey = "salesorders";
    }

    // Fetch ONE page
    const res = await fetch(apiUrl, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Zoho API error (${apiKey} page ${page}): ${text}`);
    }
    const json = await res.json();
    const items = json[apiKey] ?? [];
    const hasMore = json.page_context?.has_more_page === true;

    // Process items
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const dryRunResults: { type: string; id: string; action: string; name?: string }[] = [];
    const errors: { type: string; id: string; message: string }[] = [];

    if (entity === "contacts") {
      for (const contact of items) {
        try {
          const externalId = contact.contact_id?.toString();
          if (!externalId) { skipped++; continue; }

          const { data: existing } = await adminClient
            .from("customers").select("id")
            .eq("external_customer_id", externalId)
            .eq("source_system", sourceSystem)
            .maybeSingle();

          if (isDryRun) {
            dryRunResults.push({
              type: "customer", id: externalId,
              action: existing ? "skip" : "create",
              name: contact.company_name || contact.contact_name || undefined,
            });
            if (existing) skipped++; else imported++;
            continue;
          }

          if (existing) { skipped++; continue; }

          const { error: insertError } = await adminClient.from("customers").insert({
            external_customer_id: externalId,
            source_system: sourceSystem,
            company_name: contact.company_name ?? null,
            contact_name: contact.contact_name ?? null,
            email: contact.email ?? null,
            phone: contact.phone ?? null,
            billing_address: contact.billing_address ?? null,
            shipping_address: contact.shipping_address ?? null,
            raw_data: contact,
          });
          if (insertError) {
            failed++;
            errors.push({ type: "customer", id: externalId, message: insertError.message });
          } else {
            imported++;
          }
        } catch (err: any) {
          failed++;
          errors.push({ type: "customer", id: contact.contact_id?.toString() ?? "?", message: err?.message ?? "Unknown" });
        }
      }
    } else {
      // salesorders
      for (const order of items) {
        try {
          const externalOrderId = order.salesorder_id?.toString();
          const orderNumber = order.salesorder_number?.toString();
          const externalCustomerId = order.customer_id?.toString();

          if (!externalOrderId || !orderNumber || !externalCustomerId) {
            failed++; skipped++; continue;
          }

          const { data: existingOrder } = await adminClient
            .from("orders").select("id")
            .eq("order_number", orderNumber)
            .eq("source_system", sourceSystem)
            .maybeSingle();

          if (isDryRun) {
            dryRunResults.push({
              type: "order", id: orderNumber,
              action: existingOrder ? "skip" : "create",
              name: order.customer_name || undefined,
            });
            if (existingOrder) skipped++; else imported++;
            continue;
          }

          if (existingOrder) { skipped++; continue; }

          // Find customer
          const { data: dbCustomer } = await adminClient
            .from("customers").select("id")
            .eq("external_customer_id", externalCustomerId)
            .eq("source_system", sourceSystem)
            .maybeSingle();

          if (!dbCustomer) {
            failed++;
            errors.push({ type: "order", id: orderNumber, message: "Kunde nicht gefunden" });
            continue;
          }

          const { error: orderError } = await adminClient.from("orders").insert({
            customer_id: dbCustomer.id,
            external_order_id: externalOrderId,
            order_number: orderNumber,
            source_system: sourceSystem,
            order_status: order.status ?? "offen",
            currency: order.currency_code ?? null,
            total_amount: order.total ?? null,
            order_date: order.date ? new Date(order.date).toISOString() : null,
            raw_data: order,
          });

          if (orderError) {
            failed++;
            errors.push({ type: "order", id: orderNumber, message: orderError.message });
          } else {
            imported++;
          }
        } catch (err: any) {
          failed++;
          errors.push({ type: "order", id: order.salesorder_number?.toString() ?? "?", message: err?.message ?? "Unknown" });
        }
      }
    }

    // Log to audit_logs on first page only
    if (page === 1 && body.job_id) {
      await adminClient.from("audit_logs").insert({
        user_id: user.id,
        action: isDryRun ? "dry_run_zoho_import" : "start_zoho_import",
        module: "import_management",
        details: { source_system: sourceSystem, mode, entity, job_id: body.job_id },
      });
    }

    return jsonResponse({
      success: true,
      entity,
      page,
      has_more: hasMore,
      items_fetched: items.length,
      imported,
      skipped,
      failed,
      ...(isDryRun && dryRunResults.length > 0 ? { dry_run_results: dryRunResults } : {}),
      ...(errors.length > 0 ? { errors } : {}),
    });

  } catch (error: any) {
    console.error("start-zoho-import error:", error);
    return jsonResponse({ error: error?.message ?? "Internal server error" }, 500);
  }
});
