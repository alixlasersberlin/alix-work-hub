import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getZohoConfig(sourceSystem: string) {
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

async function getAccessToken(config: any): Promise<string> {
  const res = await fetch(`${config.accountsBaseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error("Access token missing");
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: "Missing server configuration" }, 500);
    if (!authHeader) return jsonResponse({ error: "Missing authorization header" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: callerRoles } = await adminClient.from("user_roles").select("roles!inner(name)").eq("user_id", user.id);
    const roleNames = (callerRoles ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    if (!roleNames.includes("Admin") && !roleNames.includes("Super Admin")) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const { source_system, external_order_id } = body;

    if (!source_system || !external_order_id) {
      return jsonResponse({ error: "source_system and external_order_id are required" }, 400);
    }
    if (!["zoho_eu_1", "zoho_eu_2", "zoho_us_1"].includes(source_system)) {
      return jsonResponse({ error: "Invalid source_system" }, 400);
    }

    const zohoConfig = getZohoConfig(source_system);
    if (!zohoConfig) return jsonResponse({ error: "Config not found" }, 500);

    const accessToken = await getAccessToken(zohoConfig);

    const orderRes = await fetch(
      `${zohoConfig.booksApiBaseUrl}/salesorders/${external_order_id}?organization_id=${zohoConfig.organizationId}`,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );

    if (!orderRes.ok) {
      const text = await orderRes.text();
      return jsonResponse({ error: "Zoho API error", message: text }, 502);
    }

    const orderData = await orderRes.json();
    const salesOrder = orderData.salesorder;
    if (!salesOrder) return jsonResponse({ error: "Sales order not found in Zoho response" }, 404);

    const externalCustomerId = salesOrder.customer_id?.toString();
    const orderNumber = salesOrder.salesorder_number?.toString();

    if (!externalCustomerId || !orderNumber) {
      return jsonResponse({ error: "Incomplete sales order data from Zoho" }, 422);
    }

    // Find linked customer
    const { data: customer } = await adminClient
      .from("customers")
      .select("id")
      .eq("external_customer_id", externalCustomerId)
      .eq("source_system", source_system)
      .maybeSingle();

    if (!customer) {
      return jsonResponse({
        error: "Customer not found",
        message: `Customer ${externalCustomerId} must be synced first.`,
      }, 404);
    }

    const orderPayload = {
      customer_id: customer.id,
      external_order_id: salesOrder.salesorder_id?.toString(),
      order_number: orderNumber,
      source_system,
      order_status: salesOrder.status ?? "offen",
      currency: salesOrder.currency_code ?? null,
      total_amount: salesOrder.total ?? null,
      order_date: salesOrder.date ? new Date(salesOrder.date).toISOString() : null,
      billing_address: salesOrder.billing_address ?? null,
      shipping_address: salesOrder.shipping_address ?? null,
      raw_data: salesOrder,
    };

    const { error: upsertError } = await adminClient
      .from("orders")
      .upsert(orderPayload, { onConflict: "order_number,source_system" });

    if (upsertError) {
      return jsonResponse({ error: "Order upsert failed", message: upsertError.message }, 500);
    }

    await adminClient.from("order_import_logs").insert({
      source_system,
      external_customer_id: externalCustomerId,
      external_order_id: salesOrder.salesorder_id?.toString(),
      order_number: orderNumber,
      import_status: "success",
      message: "Single order sync successful",
      imported_by: user.id,
    });

    await adminClient.from("audit_logs").insert({
      user_id: user.id,
      action: "sync_single_order",
      module: "import_management",
      details: { source_system, external_order_id, order_number: orderNumber },
    });

    return jsonResponse({
      success: true,
      order_number: orderNumber,
      source_system,
      customer_id: customer.id,
    });
  } catch (error: any) {
    console.error("sync-single-order error:", error);
    return jsonResponse({ error: "Internal server error", message: error?.message ?? null }, 500);
  }
});
