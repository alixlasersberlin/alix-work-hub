import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type ImportPayload = {
  source_system: "zoho_eu_1" | "zoho_eu_2" | "zoho_us_1";
  mode?: "manual" | "scheduled" | "dry_run";
  date_from?: string;        // ISO date string YYYY-MM-DD
  date_to?: string;          // ISO date string YYYY-MM-DD
  status_filter?: string;    // Zoho status: draft, open, closed, void, overdue
  customer_name?: string;    // Filter by customer name
  search_text?: string;      // Full-text search in Zoho
  sort_column?: string;      // e.g. date, salesorder_number, customer_name, total
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
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh Zoho token: ${text}`);
  }
  const data = await response.json();
  console.log("Zoho token response:", JSON.stringify(data));
  if (!data.access_token) throw new Error(`Zoho access token missing. Response: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function fetchAllPages(baseUrl: string, accessToken: string, key: string) {
  const allItems: any[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const url = `${baseUrl}&page=${page}&per_page=200`;
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Zoho API error (${key} page ${page}): ${text}`);
    }
    const json = await res.json();
    const items = json[key] ?? [];
    allItems.push(...items);
    hasMore = json.page_context?.has_more_page === true;
    page++;
  }
  return { items: allItems, pages: page - 1 };
}

// Validate date string format YYYY-MM-DD
function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
}

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
    const isDryRun = mode === "dry_run";
    const dateFrom = body.date_from;
    const dateTo = body.date_to;
    const statusFilter = body.status_filter;
    const customerName = body.customer_name;
    const searchText = body.search_text;
    const sortColumn = body.sort_column;
    const sortOrder = body.sort_order;

    // Validate dates if provided
    if (dateFrom && !isValidDate(dateFrom)) {
      return jsonResponse({ error: "Ungültiges Startdatum (Format: YYYY-MM-DD)" }, 400);
    }
    if (dateTo && !isValidDate(dateTo)) {
      return jsonResponse({ error: "Ungültiges Enddatum (Format: YYYY-MM-DD)" }, 400);
    }

    const allowedSources = ["zoho_eu_1", "zoho_eu_2", "zoho_us_1"];
    if (!allowedSources.includes(sourceSystem)) {
      return jsonResponse({ error: "Invalid source_system" }, 400);
    }

    const zohoConfig = getZohoConfig(sourceSystem);
    if (!zohoConfig) return jsonResponse({ error: "Zoho configuration not found" }, 500);

    const accessToken = await getZohoAccessToken(zohoConfig);

    // Build Zoho API query params with optional filters
    let ordersUrl = `${zohoConfig.booksApiBaseUrl}/salesorders?organization_id=${zohoConfig.organizationId}`;
    if (dateFrom) ordersUrl += `&date_start=${dateFrom}`;
    if (dateTo) ordersUrl += `&date_end=${dateTo}`;
    if (statusFilter) ordersUrl += `&status=${encodeURIComponent(statusFilter)}`;
    if (customerName) ordersUrl += `&customer_name=${encodeURIComponent(customerName)}`;
    if (searchText) ordersUrl += `&search_text=${encodeURIComponent(searchText)}`;
    if (sortColumn) ordersUrl += `&sort_column=${encodeURIComponent(sortColumn)}`;
    if (sortOrder) ordersUrl += `&sort_order=${encodeURIComponent(sortOrder)}`;

    const contactsResult = await fetchAllPages(
      `${zohoConfig.booksApiBaseUrl}/contacts?organization_id=${zohoConfig.organizationId}`,
      accessToken, "contacts"
    );
    const ordersResult = await fetchAllPages(ordersUrl, accessToken, "salesorders");

    const contacts = contactsResult.items;
    const salesOrders = ordersResult.items;

    let importedCustomers = 0;
    let importedOrders = 0;
    let failedImports = 0;
    let skippedCustomers = 0;
    let skippedOrders = 0;
    const dryRunResults: { type: string; id: string; action: string; name?: string }[] = [];
    const errors: { type: string; id: string; message: string }[] = [];

    const customerMap = new Map<string, string>();

    for (const contact of contacts) {
      try {
        const externalCustomerId = contact.contact_id?.toString();
        if (!externalCustomerId) { skippedCustomers++; continue; }

        if (isDryRun) {
          const { data: existing } = await adminClient
            .from("customers")
            .select("id")
            .eq("external_customer_id", externalCustomerId)
            .eq("source_system", sourceSystem)
            .maybeSingle();
          dryRunResults.push({
            type: "customer",
            id: externalCustomerId,
            action: existing ? "skip" : "create",
            name: contact.company_name || contact.contact_name || undefined,
          });
          if (existing) { skippedCustomers++; } else { importedCustomers++; }
          continue;
        }

        // Check if customer already exists — skip if so
        const { data: existingCustomer } = await adminClient
          .from("customers")
          .select("id")
          .eq("external_customer_id", externalCustomerId)
          .eq("source_system", sourceSystem)
          .maybeSingle();

        if (existingCustomer) {
          customerMap.set(externalCustomerId, existingCustomer.id);
          skippedCustomers++;
          await adminClient.from("order_import_logs").insert({
            source_system: sourceSystem,
            external_customer_id: externalCustomerId,
            import_status: "skipped",
            message: "Kunde existiert bereits – übersprungen",
            imported_by: user.id,
          });
          continue;
        }

        const customerPayload = {
          external_customer_id: externalCustomerId,
          source_system: sourceSystem,
          company_name: contact.company_name ?? null,
          contact_name: contact.contact_name ?? null,
          email: contact.email ?? null,
          phone: contact.phone ?? null,
          billing_address: contact.billing_address ?? null,
          shipping_address: contact.shipping_address ?? null,
          raw_data: contact,
        };

        const { data: insertedCustomer, error: customerError } = await adminClient
          .from("customers")
          .insert(customerPayload)
          .select("id, external_customer_id")
          .single();

        if (customerError || !insertedCustomer) {
          failedImports++;
          errors.push({ type: "customer", id: externalCustomerId, message: customerError?.message ?? "Insert failed" });
          await adminClient.from("order_import_logs").insert({
            source_system: sourceSystem,
            external_customer_id: externalCustomerId,
            import_status: "failed",
            message: customerError?.message ?? "Customer insert failed",
            imported_by: user.id,
          });
          continue;
        }

        customerMap.set(externalCustomerId, insertedCustomer.id);
        importedCustomers++;
      } catch (err: any) {
        failedImports++;
        errors.push({ type: "customer", id: contact.contact_id?.toString() ?? "unknown", message: err?.message ?? "Unknown error" });
      }
    }

    for (const salesOrder of salesOrders) {
      try {
        const externalOrderId = salesOrder.salesorder_id?.toString();
        const orderNumber = salesOrder.salesorder_number?.toString();
        const externalCustomerId = salesOrder.customer_id?.toString();

        if (!externalOrderId || !orderNumber || !externalCustomerId) {
          failedImports++;
          skippedOrders++;
          continue;
        }

        // Check if order already exists
        const { data: existingOrder } = await adminClient
          .from("orders")
          .select("id")
          .eq("order_number", orderNumber)
          .eq("source_system", sourceSystem)
          .maybeSingle();

        if (isDryRun) {
          dryRunResults.push({
            type: "order",
            id: orderNumber,
            action: existingOrder ? "skip" : "create",
            name: salesOrder.customer_name || undefined,
          });
          if (existingOrder) { skippedOrders++; } else { importedOrders++; }
          continue;
        }

        // Skip existing orders — never overwrite
        if (existingOrder) {
          skippedOrders++;
          await adminClient.from("order_import_logs").insert({
            source_system: sourceSystem,
            external_customer_id: externalCustomerId,
            external_order_id: externalOrderId,
            order_number: orderNumber,
            import_status: "skipped",
            message: "Auftrag existiert bereits – übersprungen",
            imported_by: user.id,
          });
          continue;
        }

        // Resolve customer ID
        let linkedCustomerId = customerMap.get(externalCustomerId);
        if (!linkedCustomerId) {
          // Try to find customer in DB
          const { data: dbCustomer } = await adminClient
            .from("customers")
            .select("id")
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
          await adminClient.from("order_import_logs").insert({
            source_system: sourceSystem,
            external_customer_id: externalCustomerId,
            external_order_id: externalOrderId,
            order_number: orderNumber,
            import_status: "failed",
            message: "Kunde nicht gefunden für Auftragsimport",
            imported_by: user.id,
          });
          continue;
        }

        const orderPayload = {
          customer_id: linkedCustomerId,
          external_order_id: externalOrderId,
          order_number: orderNumber,
          source_system: sourceSystem,
          order_status: salesOrder.status ?? "offen",
          currency: salesOrder.currency_code ?? null,
          total_amount: salesOrder.total ?? null,
          order_date: salesOrder.date ? new Date(salesOrder.date).toISOString() : null,
          raw_data: salesOrder,
        };

        const { error: orderError } = await adminClient
          .from("orders")
          .insert(orderPayload);

        if (orderError) {
          failedImports++;
          errors.push({ type: "order", id: orderNumber, message: orderError.message });
          await adminClient.from("order_import_logs").insert({
            source_system: sourceSystem,
            external_customer_id: externalCustomerId,
            external_order_id: externalOrderId,
            order_number: orderNumber,
            import_status: "failed",
            message: orderError.message,
            imported_by: user.id,
          });
          continue;
        }

        importedOrders++;
        await adminClient.from("order_import_logs").insert({
          source_system: sourceSystem,
          external_customer_id: externalCustomerId,
          external_order_id: externalOrderId,
          order_number: orderNumber,
          import_status: "success",
          message: "Import erfolgreich",
          imported_by: user.id,
        });
      } catch (err: any) {
        failedImports++;
        errors.push({ type: "order", id: salesOrder.salesorder_number?.toString() ?? "unknown", message: err?.message ?? "Unknown error" });
      }
    }

    await adminClient.from("audit_logs").insert({
      user_id: user.id,
      action: isDryRun ? "dry_run_zoho_import" : "start_zoho_import",
      module: "import_management",
      details: {
        source_system: sourceSystem,
        mode,
        is_dry_run: isDryRun,
        date_from: dateFrom ?? null,
        date_to: dateTo ?? null,
        status_filter: statusFilter ?? null,
        customer_name: customerName ?? null,
        search_text: searchText ?? null,
        imported_customers: importedCustomers,
        imported_orders: importedOrders,
        skipped_customers: skippedCustomers,
        skipped_orders: skippedOrders,
        failed_imports: failedImports,
        contact_pages: contactsResult.pages,
        order_pages: ordersResult.pages,
      },
    });

    return jsonResponse({
      success: true,
      source_system: sourceSystem,
      mode,
      is_dry_run: isDryRun,
      date_from: dateFrom ?? null,
      date_to: dateTo ?? null,
      imported_customers: importedCustomers,
      imported_orders: importedOrders,
      failed_imports: failedImports,
      skipped_customers: skippedCustomers,
      skipped_orders: skippedOrders,
      contact_pages: contactsResult.pages,
      order_pages: ordersResult.pages,
      total_contacts_fetched: contacts.length,
      total_orders_fetched: salesOrders.length,
      ...(isDryRun ? { dry_run_results: dryRunResults } : {}),
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error: any) {
    console.error("start-zoho-import error:", error);
    return jsonResponse({ error: "Internal server error", message: error?.message ?? null }, 500);
  }
});
