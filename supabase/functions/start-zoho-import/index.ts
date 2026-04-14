import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type ImportPayload = {
  source_system: "zoho_eu_1" | "zoho_eu_2" | "zoho_us_1";
  mode?: "manual" | "scheduled" | "dry_run";
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

  if (!response.ok) {
    throw new Error(`Failed to refresh Zoho token: ${JSON.stringify(data)}`);
  }

  if (!data.access_token) {
    if (data.error === "invalid_code") {
      throw new Error("Zoho refresh token is invalid or revoked for this data center. Please update ZOHO_EU_1_REFRESH_TOKEN with a newly generated EU refresh token.");
    }
    throw new Error(`Zoho access token missing. Response: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

async function fetchPage(baseUrl: string, accessToken: string, key: string, page: number) {
  const url = `${baseUrl}&page=${page}&per_page=200`;
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho API error (${key} page ${page}): ${text}`);
  }
  const json = await res.json();
  const items = json[key] ?? [];
  const hasMore = json.page_context?.has_more_page === true;
  return { items, hasMore };
}

function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
}

// ── Background processing function ──
async function processImport(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  jobId: string,
  body: ImportPayload,
) {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const sourceSystem = body.source_system;
  const mode = body.mode ?? "manual";
  const isDryRun = mode === "dry_run";

  try {
    // Update job status to processing
    await adminClient.from("order_import_logs").insert({
      source_system: sourceSystem,
      import_status: "processing",
      message: `Import-Job ${jobId} gestartet (${mode})`,
      imported_by: userId,
    });

    const zohoConfig = getZohoConfig(sourceSystem);
    if (!zohoConfig) throw new Error("Zoho configuration not found");

    const accessToken = await getZohoAccessToken(zohoConfig);

    // Build Zoho API query params
    let ordersUrl = `${zohoConfig.booksApiBaseUrl}/salesorders?organization_id=${zohoConfig.organizationId}`;
    if (body.date_from) ordersUrl += `&date_start=${body.date_from}`;
    if (body.date_to) ordersUrl += `&date_end=${body.date_to}`;
    if (body.status_filter) ordersUrl += `&status=${encodeURIComponent(body.status_filter)}`;
    if (body.customer_name) ordersUrl += `&customer_name=${encodeURIComponent(body.customer_name)}`;
    if (body.search_text) ordersUrl += `&search_text=${encodeURIComponent(body.search_text)}`;
    if (body.sort_column) ordersUrl += `&sort_column=${encodeURIComponent(body.sort_column)}`;
    if (body.sort_order) {
      const zohoSortOrder = body.sort_order === "ascending" ? "A" : "D";
      ordersUrl += `&sort_order=${zohoSortOrder}`;
    }

    // Fetch contacts page by page
    const contacts: any[] = [];
    let page = 1;
    let hasMore = true;
    const contactsUrl = `${zohoConfig.booksApiBaseUrl}/contacts?organization_id=${zohoConfig.organizationId}`;
    while (hasMore) {
      const result = await fetchPage(contactsUrl, accessToken, "contacts", page);
      contacts.push(...result.items);
      hasMore = result.hasMore;
      page++;
    }
    const contactPages = page - 1;

    // Fetch orders page by page
    const salesOrders: any[] = [];
    page = 1;
    hasMore = true;
    while (hasMore) {
      const result = await fetchPage(ordersUrl, accessToken, "salesorders", page);
      salesOrders.push(...result.items);
      hasMore = result.hasMore;
      page++;
    }
    const orderPages = page - 1;

    let importedCustomers = 0;
    let importedOrders = 0;
    let failedImports = 0;
    let skippedCustomers = 0;
    let skippedOrders = 0;
    const dryRunResults: { type: string; id: string; action: string; name?: string }[] = [];
    const errors: { type: string; id: string; message: string }[] = [];
    const customerMap = new Map<string, string>();

    // Process contacts
    for (const contact of contacts) {
      try {
        const externalCustomerId = contact.contact_id?.toString();
        if (!externalCustomerId) { skippedCustomers++; continue; }

        const { data: existingCustomer } = await adminClient
          .from("customers").select("id")
          .eq("external_customer_id", externalCustomerId)
          .eq("source_system", sourceSystem)
          .maybeSingle();

        if (isDryRun) {
          dryRunResults.push({
            type: "customer", id: externalCustomerId,
            action: existingCustomer ? "skip" : "create",
            name: contact.company_name || contact.contact_name || undefined,
          });
          if (existingCustomer) skippedCustomers++; else importedCustomers++;
          continue;
        }

        if (existingCustomer) {
          customerMap.set(externalCustomerId, existingCustomer.id);
          skippedCustomers++;
          continue;
        }

        const { data: insertedCustomer, error: customerError } = await adminClient
          .from("customers").insert({
            external_customer_id: externalCustomerId,
            source_system: sourceSystem,
            company_name: contact.company_name ?? null,
            contact_name: contact.contact_name ?? null,
            email: contact.email ?? null,
            phone: contact.phone ?? null,
            billing_address: contact.billing_address ?? null,
            shipping_address: contact.shipping_address ?? null,
            raw_data: contact,
          }).select("id, external_customer_id").single();

        if (customerError || !insertedCustomer) {
          failedImports++;
          errors.push({ type: "customer", id: externalCustomerId, message: customerError?.message ?? "Insert failed" });
          continue;
        }

        customerMap.set(externalCustomerId, insertedCustomer.id);
        importedCustomers++;
      } catch (err: any) {
        failedImports++;
        errors.push({ type: "customer", id: contact.contact_id?.toString() ?? "unknown", message: err?.message ?? "Unknown error" });
      }
    }

    // Process orders
    for (const salesOrder of salesOrders) {
      try {
        const externalOrderId = salesOrder.salesorder_id?.toString();
        const orderNumber = salesOrder.salesorder_number?.toString();
        const externalCustomerId = salesOrder.customer_id?.toString();

        if (!externalOrderId || !orderNumber || !externalCustomerId) {
          failedImports++; skippedOrders++; continue;
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
            name: salesOrder.customer_name || undefined,
          });
          if (existingOrder) skippedOrders++; else importedOrders++;
          continue;
        }

        if (existingOrder) { skippedOrders++; continue; }

        let linkedCustomerId = customerMap.get(externalCustomerId);
        if (!linkedCustomerId) {
          const { data: dbCustomer } = await adminClient
            .from("customers").select("id")
            .eq("external_customer_id", externalCustomerId)
            .eq("source_system", sourceSystem)
            .maybeSingle();
          if (dbCustomer) {
            linkedCustomerId = dbCustomer.id;
            customerMap.set(externalCustomerId, dbCustomer.id);
          }
        }

        if (!linkedCustomerId) {
          failedImports++;
          errors.push({ type: "order", id: orderNumber, message: "Kunde nicht gefunden" });
          continue;
        }

        const { error: orderError } = await adminClient.from("orders").insert({
          customer_id: linkedCustomerId,
          external_order_id: externalOrderId,
          order_number: orderNumber,
          source_system: sourceSystem,
          order_status: salesOrder.status ?? "offen",
          currency: salesOrder.currency_code ?? null,
          total_amount: salesOrder.total ?? null,
          order_date: salesOrder.date ? new Date(salesOrder.date).toISOString() : null,
          raw_data: salesOrder,
        });

        if (orderError) {
          failedImports++;
          errors.push({ type: "order", id: orderNumber, message: orderError.message });
          continue;
        }
        importedOrders++;
      } catch (err: any) {
        failedImports++;
        errors.push({ type: "order", id: salesOrder.salesorder_number?.toString() ?? "unknown", message: err?.message ?? "Unknown error" });
      }
    }

    // Write final result as audit log
    const result = {
      success: true,
      source_system: sourceSystem,
      mode,
      is_dry_run: isDryRun,
      imported_customers: importedCustomers,
      imported_orders: importedOrders,
      failed_imports: failedImports,
      skipped_customers: skippedCustomers,
      skipped_orders: skippedOrders,
      contact_pages: contactPages,
      order_pages: orderPages,
      total_contacts_fetched: contacts.length,
      total_orders_fetched: salesOrders.length,
      ...(isDryRun ? { dry_run_results: dryRunResults } : {}),
      ...(errors.length > 0 ? { errors } : {}),
    };

    await adminClient.from("audit_logs").insert({
      user_id: userId,
      action: isDryRun ? "dry_run_zoho_import" : "start_zoho_import",
      module: "import_management",
      details: result,
    });

    // Store result for polling
    await adminClient.from("order_import_logs").insert({
      source_system: sourceSystem,
      import_status: "completed",
      message: JSON.stringify(result),
      imported_by: userId,
      order_number: jobId,
    });

    console.log(`Import job ${jobId} completed successfully.`);
  } catch (error: any) {
    console.error(`Import job ${jobId} failed:`, error);
    await adminClient.from("order_import_logs").insert({
      source_system: body.source_system,
      import_status: "failed",
      message: error?.message ?? "Unknown error",
      imported_by: userId,
      order_number: jobId,
    });
  }
}

// ── Main handler ──
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

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: callerRoles, error: callerRolesError } = await adminClient
      .from("user_roles").select("roles!inner(name)").eq("user_id", user.id);
    if (callerRolesError) return jsonResponse({ error: "Failed to verify caller roles" }, 500);

    const roleNames = (callerRoles ?? []).map((row: any) => row.roles?.name).filter(Boolean);
    const isAdmin = roleNames.includes("Admin") || roleNames.includes("Super Admin");
    if (!isAdmin) return jsonResponse({ error: "Forbidden" }, 403);

    const body = (await req.json()) as ImportPayload;
    const sourceSystem = body.source_system;
    const mode = body.mode ?? "manual";

    // Validate
    if (body.date_from && !isValidDate(body.date_from)) {
      return jsonResponse({ error: "Ungültiges Startdatum (Format: YYYY-MM-DD)" }, 400);
    }
    if (body.date_to && !isValidDate(body.date_to)) {
      return jsonResponse({ error: "Ungültiges Enddatum (Format: YYYY-MM-DD)" }, 400);
    }

    const allowedSources = ["zoho_eu_1", "zoho_eu_2", "zoho_us_1"];
    if (!allowedSources.includes(sourceSystem)) {
      return jsonResponse({ error: "Invalid source_system" }, 400);
    }

    // Validate Zoho credentials upfront (fast, before background)
    const zohoConfig = getZohoConfig(sourceSystem);
    if (!zohoConfig) return jsonResponse({ error: "Zoho configuration not found" }, 500);

    // Test token before going async
    const accessToken = await getZohoAccessToken(zohoConfig);
    if (!accessToken) {
      return jsonResponse({ error: "Zoho authorization failed" }, 400);
    }

    // Generate job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Start background processing
    EdgeRuntime.waitUntil(
      processImport(supabaseUrl, serviceRoleKey, user.id, jobId, body)
    );

    // Return immediately
    return jsonResponse({
      success: true,
      job_id: jobId,
      source_system: sourceSystem,
      mode,
      status: "processing",
      message: "Import wurde gestartet und läuft im Hintergrund.",
    });

  } catch (error: any) {
    console.error("start-zoho-import error:", error);
    const message = error?.message ?? null;
    const status = typeof message === "string" && message.includes("Zoho refresh token is invalid or revoked") ? 400 : 500;
    return jsonResponse({ error: status === 400 ? "Zoho authorization invalid" : "Internal server error", message }, status);
  }
});
