import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type ImportPayload = {
  source_system: "zoho_eu_1" | "zoho_eu_2" | "zoho_us_1";
  mode?: "manual" | "scheduled" | "dry_run";
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
  if (!data.access_token) throw new Error("Zoho access token missing");
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

    const allowedSources = ["zoho_eu_1", "zoho_eu_2", "zoho_us_1"];
    if (!allowedSources.includes(sourceSystem)) {
      return jsonResponse({ error: "Invalid source_system" }, 400);
    }

    const zohoConfig = getZohoConfig(sourceSystem);
    if (!zohoConfig) return jsonResponse({ error: "Zoho configuration not found" }, 500);

    const accessToken = await getZohoAccessToken(zohoConfig);

    const contactsResult = await fetchAllPages(
      `${zohoConfig.booksApiBaseUrl}/contacts?organization_id=${zohoConfig.organizationId}`,
      accessToken, "contacts"
    );
    const ordersResult = await fetchAllPages(
      `${zohoConfig.booksApiBaseUrl}/salesorders?organization_id=${zohoConfig.organizationId}`,
      accessToken, "salesorders"
    );

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
          // Check if customer exists
          const { data: existing } = await adminClient
            .from("customers")
            .select("id")
            .eq("external_customer_id", externalCustomerId)
            .eq("source_system", sourceSystem)
            .maybeSingle();
          dryRunResults.push({
            type: "customer",
            id: externalCustomerId,
            action: existing ? "update" : "create",
            name: contact.company_name || contact.contact_name || undefined,
          });
          importedCustomers++;
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

        const { data: upsertedCustomer, error: customerError } = await adminClient
          .from("customers")
          .upsert(customerPayload, { onConflict: "external_customer_id,source_system" })
          .select("id, external_customer_id")
          .single();

        if (customerError || !upsertedCustomer) {
          failedImports++;
          errors.push({ type: "customer", id: externalCustomerId, message: customerError?.message ?? "Upsert failed" });
          await adminClient.from("order_import_logs").insert({
            source_system: sourceSystem,
            external_customer_id: externalCustomerId,
            import_status: "failed",
            message: customerError?.message ?? "Customer upsert failed",
            imported_by: user.id,
          });
          continue;
        }

        customerMap.set(externalCustomerId, upsertedCustomer.id);
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

        if (isDryRun) {
          const { data: existing } = await adminClient
            .from("orders")
            .select("id")
            .eq("order_number", orderNumber)
            .eq("source_system", sourceSystem)
            .maybeSingle();
          dryRunResults.push({
            type: "order",
            id: orderNumber,
            action: existing ? "update" : "create",
            name: salesOrder.customer_name || undefined,
          });
          importedOrders++;
          continue;
        }

        const linkedCustomerId = customerMap.get(externalCustomerId);
        if (!linkedCustomerId) {
          failedImports++;
          errors.push({ type: "order", id: orderNumber, message: "Customer missing" });
          await adminClient.from("order_import_logs").insert({
            source_system: sourceSystem,
            external_customer_id: externalCustomerId,
            external_order_id: externalOrderId,
            order_number: orderNumber,
            import_status: "failed",
            message: "Customer missing for sales order import",
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
          .upsert(orderPayload, { onConflict: "order_number,source_system" });

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
          message: "Import successful",
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
        imported_customers: importedCustomers,
        imported_orders: importedOrders,
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
