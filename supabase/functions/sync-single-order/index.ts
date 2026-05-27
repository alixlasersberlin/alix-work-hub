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
    clientId: (sourceSystem === "zoho_eu_2" ? Deno.env.get("ZOHO_EU_1_CLIENT_ID") ?? "" : Deno.env.get(`${cfg.prefix}_CLIENT_ID`) ?? ""),
    clientSecret: (sourceSystem === "zoho_eu_2" ? Deno.env.get("ZOHO_EU_1_CLIENT_SECRET") ?? "" : Deno.env.get(`${cfg.prefix}_CLIENT_SECRET`) ?? ""),
    refreshToken: (sourceSystem === "zoho_eu_2" ? Deno.env.get("ZOHO_EU_1_REFRESH_TOKEN") ?? "" : Deno.env.get(`${cfg.prefix}_REFRESH_TOKEN`) ?? ""),
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

async function syncLineItems(adminClient: any, orderId: string, lineItems: any[], sourceSystem: string) {
  if (!lineItems || lineItems.length === 0) return;

  const isAt = sourceSystem === "zoho_eu_2";
  const atSuffix = (v: any) =>
    v == null || v === "" ? v : (isAt && !String(v).endsWith("-AT") ? `${v}-AT` : v);

  for (let i = 0; i < lineItems.length; i++) {
    const li = lineItems[i];
    const externalItemId = li.line_item_id?.toString() || li.item_id?.toString() || null;

    const itemPayload = {
      order_id: orderId,
      external_item_id: externalItemId,
      item_name: atSuffix(li.name ?? li.item_name ?? null),
      description: li.description ?? null,
      sku: atSuffix(li.sku ?? li.item_code ?? null),
      quantity: li.quantity ?? 1,
      rate: li.rate ?? null,
      amount: li.item_total ?? li.amount ?? null,
      discount: li.discount_amount ?? li.discount ?? 0,
      tax_amount: li.tax_amount ?? 0,
      unit: li.unit ?? null,
      item_order: li.item_order ?? i,
      raw_data: li,
    };

    if (externalItemId) {
      const { data: existing } = await adminClient
        .from("order_items")
        .select("id")
        .eq("order_id", orderId)
        .eq("external_item_id", externalItemId)
        .maybeSingle();

      if (existing) {
        await adminClient.from("order_items").update(itemPayload).eq("id", existing.id);
      } else {
        await adminClient.from("order_items").insert(itemPayload);
      }
    } else {
      await adminClient.from("order_items").insert(itemPayload);
    }
  }

  const externalIds = lineItems
    .map((li: any) => li.line_item_id?.toString() || li.item_id?.toString())
    .filter(Boolean);

  if (externalIds.length > 0) {
    await adminClient
      .from("order_items")
      .delete()
      .eq("order_id", orderId)
      .not("external_item_id", "in", `(${externalIds.join(",")})`);
  }
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

    // Resolve salesorder_id: accept either numeric Zoho ID OR order number (e.g. "SO-4190")
    const rawOrderInput = String(external_order_id).trim();
    let resolvedSalesOrderId = rawOrderInput;
    const isNumericOrderId = /^\d+$/.test(rawOrderInput);

    if (!isNumericOrderId) {
      const lookupUrl = `${zohoConfig.booksApiBaseUrl}/salesorders?organization_id=${zohoConfig.organizationId}&salesorder_number=${encodeURIComponent(rawOrderInput)}`;
      const lookupRes = await fetch(lookupUrl, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      if (!lookupRes.ok) {
        const text = await lookupRes.text();
        return jsonResponse({ error: "Zoho lookup failed", message: text }, 502);
      }
      const lookupJson = await lookupRes.json();
      const matches = Array.isArray(lookupJson.salesorders) ? lookupJson.salesorders : [];
      if (matches.length === 0) {
        return jsonResponse({
          success: false,
          error: "Order not found in Zoho",
          message: `Kein Auftrag mit Nummer "${rawOrderInput}" in ${source_system} gefunden.`,
        }, 200);
      }
      resolvedSalesOrderId = String(matches[0].salesorder_id);
      console.log(`[sync-single-order] Resolved ${rawOrderInput} -> salesorder_id ${resolvedSalesOrderId}`);
    }

    const orderRes = await fetch(
      `${zohoConfig.booksApiBaseUrl}/salesorders/${resolvedSalesOrderId}?organization_id=${zohoConfig.organizationId}`,
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

    // Pre-check: skip if order already exists locally
    const externalOrderIdStr = salesOrder.salesorder_id?.toString();
    const { data: existingOrder } = await adminClient
      .from("orders")
      .select("id, order_number")
      .eq("source_system", source_system)
      .or(`external_order_id.eq.${externalOrderIdStr},order_number.eq.${orderNumber}`)
      .maybeSingle();

    if (existingOrder) {
      console.log(`[sync-single-order] Order ${orderNumber} already exists, skipping import.`);
      return jsonResponse({
        success: false,
        already_exists: true,
        order_number: orderNumber,
        source_system,
        message: `Auftrag "${orderNumber}" ist bereits im System vorhanden und wurde nicht erneut importiert.`,
      }, 200);
    }

    // Find linked customer - auto-sync from Zoho if missing
    let { data: customer } = await adminClient
      .from("customers")
      .select("id")
      .eq("external_customer_id", externalCustomerId)
      .eq("source_system", source_system)
      .maybeSingle();

    if (!customer) {
      console.log(`[sync-single-order] Customer ${externalCustomerId} not found locally, fetching from Zoho...`);
      const contactRes = await fetch(
        `${zohoConfig.booksApiBaseUrl}/contacts/${externalCustomerId}?organization_id=${zohoConfig.organizationId}`,
        { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
      );
      if (!contactRes.ok) {
        const text = await contactRes.text();
        return jsonResponse({
          error: "Customer auto-sync failed",
          message: `Could not fetch customer ${externalCustomerId} from Zoho: ${text}`,
        }, 502);
      }
      const contactJson = await contactRes.json();
      const contact = contactJson.contact;
      if (!contact) {
        return jsonResponse({ error: "Customer not found in Zoho", message: `Contact ${externalCustomerId} missing in Zoho response.` }, 404);
      }

      const customerPayload = {
        external_customer_id: contact.contact_id?.toString(),
        source_system,
        company_name: contact.company_name ?? null,
        contact_name: contact.contact_name ?? null,
        email: contact.email ?? null,
        phone: contact.mobile || contact.phone || null,
        billing_address: contact.billing_address ?? null,
        shipping_address: contact.shipping_address ?? null,
        raw_data: contact,
      };

      const { data: upsertedCustomer, error: customerUpsertError } = await adminClient
        .from("customers")
        .upsert(customerPayload, { onConflict: "external_customer_id,source_system" })
        .select("id")
        .single();

      if (customerUpsertError || !upsertedCustomer) {
        return jsonResponse({
          error: "Customer auto-create failed",
          message: customerUpsertError?.message ?? "Unknown",
        }, 500);
      }
      customer = upsertedCustomer;
      console.log(`[sync-single-order] Auto-created customer ${externalCustomerId} -> ${customer.id}`);
    }

    const orderDateIso = salesOrder.date ? new Date(salesOrder.date).toISOString() : null;
    let expectedShipmentDate: string | null = null;
    if (salesOrder.shipment_date) {
      expectedShipmentDate = new Date(salesOrder.shipment_date).toISOString();
    } else {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + 56);
      expectedShipmentDate = fallback.toISOString();
    }

    const orderPayload = {
      customer_id: customer.id,
      external_order_id: salesOrder.salesorder_id?.toString(),
      order_number: orderNumber,
      source_system,
      order_status: salesOrder.status ?? "offen",
      currency: salesOrder.currency_code ?? null,
      total_amount: salesOrder.total ?? null,
      order_date: orderDateIso,
      expected_shipment_date: expectedShipmentDate,
      billing_address: salesOrder.billing_address ?? null,
      shipping_address: salesOrder.shipping_address ?? null,
      raw_data: salesOrder,
    };

    const { data: upsertedOrder, error: upsertError } = await adminClient
      .from("orders")
      .upsert(orderPayload, { onConflict: "order_number,source_system" })
      .select("id")
      .single();

    if (upsertError || !upsertedOrder) {
      return jsonResponse({ error: "Order upsert failed", message: upsertError?.message ?? "Unknown" }, 500);
    }

    // Sync line items
    await syncLineItems(adminClient, upsertedOrder.id, salesOrder.line_items ?? []);

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
