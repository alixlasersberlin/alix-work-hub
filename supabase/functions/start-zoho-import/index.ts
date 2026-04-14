import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type ImportPayload = {
  source_system: "zoho_eu_1" | "zoho_eu_2" | "zoho_us_1";
  mode?: "manual" | "scheduled";
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
  if (sourceSystem === "zoho_eu_1") {
    return {
      clientId: Deno.env.get("ZOHO_EU_1_CLIENT_ID") ?? "",
      clientSecret: Deno.env.get("ZOHO_EU_1_CLIENT_SECRET") ?? "",
      refreshToken: Deno.env.get("ZOHO_EU_1_REFRESH_TOKEN") ?? "",
      organizationId: Deno.env.get("ZOHO_EU_1_ORGANIZATION_ID") ?? "",
      accountsBaseUrl: "https://accounts.zoho.eu",
      booksApiBaseUrl: "https://www.zohoapis.eu/books/v3",
    };
  }

  if (sourceSystem === "zoho_eu_2") {
    return {
      clientId: Deno.env.get("ZOHO_EU_2_CLIENT_ID") ?? "",
      clientSecret: Deno.env.get("ZOHO_EU_2_CLIENT_SECRET") ?? "",
      refreshToken: Deno.env.get("ZOHO_EU_2_REFRESH_TOKEN") ?? "",
      organizationId: Deno.env.get("ZOHO_EU_2_ORGANIZATION_ID") ?? "",
      accountsBaseUrl: "https://accounts.zoho.eu",
      booksApiBaseUrl: "https://www.zohoapis.eu/books/v3",
    };
  }

  if (sourceSystem === "zoho_us_1") {
    return {
      clientId: Deno.env.get("ZOHO_US_1_CLIENT_ID") ?? "",
      clientSecret: Deno.env.get("ZOHO_US_1_CLIENT_SECRET") ?? "",
      refreshToken: Deno.env.get("ZOHO_US_1_REFRESH_TOKEN") ?? "",
      organizationId: Deno.env.get("ZOHO_US_1_ORGANIZATION_ID") ?? "",
      accountsBaseUrl: "https://accounts.zoho.com",
      booksApiBaseUrl: "https://www.zohoapis.com/books/v3",
    };
  }

  return null;
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
  if (!data.access_token) {
    throw new Error("Zoho access token missing");
  }

  return data.access_token;
}

async function fetchZohoContacts(config: ZohoConfig, accessToken: string) {
  const response = await fetch(
    `${config.booksApiBaseUrl}/contacts?organization_id=${config.organizationId}`,
    {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch Zoho contacts: ${text}`);
  }

  return await response.json();
}

async function fetchZohoSalesOrders(config: ZohoConfig, accessToken: string) {
  const response = await fetch(
    `${config.booksApiBaseUrl}/salesorders?organization_id=${config.organizationId}`,
    {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch Zoho sales orders: ${text}`);
  }

  return await response.json();
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

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: callerRoles, error: callerRolesError } = await adminClient
      .from("user_roles")
      .select("roles!inner(name)")
      .eq("user_id", user.id);

    if (callerRolesError) {
      return jsonResponse({ error: "Failed to verify caller roles" }, 500);
    }

    const roleNames = (callerRoles ?? [])
      .map((row: any) => row.roles?.name)
      .filter(Boolean);

    const isAdmin = roleNames.includes("Admin") || roleNames.includes("Super Admin");

    if (!isAdmin) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body = (await req.json()) as ImportPayload;
    const sourceSystem = body.source_system;
    const mode = body.mode ?? "manual";

    const allowedSources = ["zoho_eu_1", "zoho_eu_2", "zoho_us_1"];
    if (!allowedSources.includes(sourceSystem)) {
      return jsonResponse({ error: "Invalid source_system" }, 400);
    }

    const zohoConfig = getZohoConfig(sourceSystem);
    if (!zohoConfig) {
      return jsonResponse({ error: "Zoho configuration not found" }, 500);
    }

    const accessToken = await getZohoAccessToken(zohoConfig);

    const contactsResponse = await fetchZohoContacts(zohoConfig, accessToken);
    const ordersResponse = await fetchZohoSalesOrders(zohoConfig, accessToken);

    const contacts = contactsResponse.contacts ?? [];
    const salesOrders = ordersResponse.salesorders ?? [];

    let importedCustomers = 0;
    let importedOrders = 0;
    let failedImports = 0;

    const customerMap = new Map<string, string>();

    for (const contact of contacts) {
      try {
        const externalCustomerId = contact.contact_id?.toString();
        if (!externalCustomerId) continue;

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
          .upsert(customerPayload, {
            onConflict: "external_customer_id,source_system",
          })
          .select("id, external_customer_id")
          .single();

        if (customerError || !upsertedCustomer) {
          failedImports++;
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
      } catch (err) {
        failedImports++;
      }
    }

    for (const salesOrder of salesOrders) {
      try {
        const externalOrderId = salesOrder.salesorder_id?.toString();
        const orderNumber = salesOrder.salesorder_number?.toString();
        const externalCustomerId = salesOrder.customer_id?.toString();

        if (!externalOrderId || !orderNumber || !externalCustomerId) {
          failedImports++;
          continue;
        }

        const linkedCustomerId = customerMap.get(externalCustomerId);

        if (!linkedCustomerId) {
          failedImports++;
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
          .upsert(orderPayload, {
            onConflict: "order_number,source_system",
          });

        if (orderError) {
          failedImports++;
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
      }
    }

    await adminClient.from("audit_logs").insert({
      user_id: user.id,
      action: "start_zoho_import",
      module: "import_management",
      details: {
        source_system: sourceSystem,
        mode,
        imported_customers: importedCustomers,
        imported_orders: importedOrders,
        failed_imports: failedImports,
      },
    });

    return jsonResponse({
      success: true,
      source_system: sourceSystem,
      mode,
      imported_customers: importedCustomers,
      imported_orders: importedOrders,
      failed_imports: failedImports,
    });
  } catch (error: any) {
    console.error("start-zoho-import error:", error);
    return jsonResponse(
      {
        error: "Internal server error",
        message: error?.message ?? null,
      },
      500
    );
  }
});
