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

const tokenCache: Record<string, { token: string; expiresAt: number }> = {};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
    clientId: (sourceSystem === "zoho_eu_2" ? Deno.env.get("ZOHO_EU_1_CLIENT_ID") ?? "" : Deno.env.get(`${cfg.prefix}_CLIENT_ID`) ?? ""),
    clientSecret: (sourceSystem === "zoho_eu_2" ? Deno.env.get("ZOHO_EU_1_CLIENT_SECRET") ?? "" : Deno.env.get(`${cfg.prefix}_CLIENT_SECRET`) ?? ""),
    refreshToken: (sourceSystem === "zoho_eu_2" ? Deno.env.get("ZOHO_EU_1_REFRESH_TOKEN") ?? "" : Deno.env.get(`${cfg.prefix}_REFRESH_TOKEN`) ?? ""),
    organizationId: Deno.env.get(`${cfg.prefix}_ORGANIZATION_ID`) ?? "",
    accountsBaseUrl: cfg.accountsBase,
    booksApiBaseUrl: cfg.apiBase,
  };
}

async function getAccessToken(config: ZohoConfig): Promise<string> {
  const cacheKey = `${config.clientId}_${config.organizationId}`;
  const cached = tokenCache[cacheKey];
  if (cached && Date.now() < cached.expiresAt) return cached.token;
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
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  tokenCache[cacheKey] = { token: data.access_token, expiresAt: Date.now() + 50 * 60 * 1000 };
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
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startTime = Date.now();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const apiKeyHeader = req.headers.get("apikey") ?? "";
    const isServiceCall = authHeader === `Bearer ${serviceRoleKey}` || apiKeyHeader === serviceRoleKey;

    // Allow either service role OR a valid anon-key call (cron uses anon key)
    if (!isServiceCall) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const isAnonCall = apiKeyHeader === anonKey;
      if (!isAnonCall) {
        // Try authenticated admin user
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const token = authHeader.replace("Bearer ", "");
        const { data, error } = await userClient.auth.getUser(token);
        const user = data?.user;
        if (error || !user) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const adminCheck = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
        const { data: roles } = await adminCheck.from("user_roles").select("roles!inner(name)").eq("user_id", user.id);
        const roleNames = (roles ?? []).map((r: any) => r.roles?.name).filter(Boolean);
        if (!roleNames.includes("Admin") && !roleNames.includes("Super Admin")) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* ignore */ }

    const sourceSystem = (body.source_system as string) ?? "zoho_eu_1";
    const zohoConfig = getZohoConfig(sourceSystem);
    if (!zohoConfig) {
      return new Response(JSON.stringify({ error: "Invalid source_system" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken(zohoConfig);

    const daysBack = Math.max(1, Math.min(365, Number(body.days_back ?? 1) || 1));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    cutoff.setHours(0, 0, 0, 0);
    // Zoho Books requires ISO8601 datetime, e.g. 2026-05-13T00:00:00+0000
    const lastModifiedAfter = cutoff.toISOString().replace(/\.\d{3}Z$/, "+0000");

    console.log(`[scheduled-order-sync] Start ${sourceSystem}, modified since ${lastModifiedAfter}`);

    let page = 1;
    let totalImported = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let totalFetched = 0;
    let autoSyncedCustomers = 0;
    const errors: { id: string; message: string }[] = [];
    const MAX_PAGES = 50;
    const maxOrders = body.max_orders != null ? Math.max(1, Number(body.max_orders)) : null;
    const autoSyncCustomers = body.auto_sync_customers !== false;

    async function ensureCustomer(externalCustomerId: string): Promise<string | null> {
      const { data: existing } = await adminClient
        .from("customers").select("id")
        .eq("external_customer_id", externalCustomerId)
        .eq("source_system", sourceSystem).maybeSingle();
      if (existing) return existing.id;
      if (!autoSyncCustomers) return null;
      try {
        const cRes = await fetch(
          `${zohoConfig.booksApiBaseUrl}/contacts/${externalCustomerId}?organization_id=${zohoConfig.organizationId}`,
          { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
        );
        if (!cRes.ok) return null;
        const cJson = await cRes.json();
        const c = cJson.contact;
        if (!c) return null;
        const { data: ins, error: insErr } = await adminClient.from("customers").upsert({
          external_customer_id: String(c.contact_id),
          source_system: sourceSystem,
          company_name: c.company_name ?? null,
          contact_name: c.contact_name ?? null,
          email: c.email ?? null,
          phone: c.mobile || c.phone || null,
          billing_address: c.billing_address ?? null,
          shipping_address: c.shipping_address ?? null,
          raw_data: c,
        }, { onConflict: "external_customer_id,source_system" }).select("id").single();
        if (insErr || !ins) return null;
        autoSyncedCustomers++;
        return ins.id;
      } catch { return null; }
    }

    while (page <= MAX_PAGES) {
      const apiUrl = `${zohoConfig.booksApiBaseUrl}/salesorders?organization_id=${zohoConfig.organizationId}&page=${page}&per_page=200&last_modified_time=${encodeURIComponent(lastModifiedAfter)}`;
      const res = await fetch(apiUrl, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
      if (!res.ok) {
        const text = await res.text();
        console.error(`[scheduled-order-sync] Zoho error page ${page}: ${text}`);
        break;
      }
      const json = await res.json();
      const salesorders = json.salesorders ?? [];
      const hasMore = json.page_context?.has_more_page === true;
      console.log(`[scheduled-order-sync] Page ${page}: ${salesorders.length} orders, hasMore=${hasMore}`);
      if (salesorders.length === 0) break;
      totalFetched += salesorders.length;

      for (const so of salesorders) {
        const externalOrderId = so.salesorder_id?.toString();
        if (!externalOrderId) { totalSkipped++; continue; }
        const externalCustomerId = so.customer_id?.toString();
        if (!externalCustomerId) { totalSkipped++; continue; }

        try {
          // Find local customer
          const { data: customer } = await adminClient
            .from("customers")
            .select("id")
            .eq("external_customer_id", externalCustomerId)
            .eq("source_system", sourceSystem)
            .maybeSingle();
          if (!customer) {
            totalSkipped++;
            errors.push({ id: externalOrderId, message: `Customer ${externalCustomerId} not found locally` });
            continue;
          }

          // Fetch detail for line_items + addresses
          let detail = so;
          try {
            const dRes = await fetch(
              `${zohoConfig.booksApiBaseUrl}/salesorders/${externalOrderId}?organization_id=${zohoConfig.organizationId}`,
              { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
            );
            if (dRes.ok) {
              const dJson = await dRes.json();
              if (dJson.salesorder) detail = dJson.salesorder;
            }
          } catch (_) { /* ignore */ }

          const orderPayload = {
            external_order_id: externalOrderId,
            source_system: sourceSystem,
            customer_id: customer.id,
            order_number: detail.salesorder_number ?? so.salesorder_number ?? externalOrderId,
            order_date: detail.date ?? so.date ?? null,
            expected_shipment_date: detail.shipment_date ?? so.shipment_date ?? null,
            order_status: detail.status ?? so.status ?? "offen",
            total_amount: detail.total ?? so.total ?? null,
            currency: detail.currency_code ?? so.currency_code ?? null,
            salesperson_name: detail.salesperson_name ?? so.salesperson_name ?? null,
            shipping_address: detail.shipping_address ?? null,
            billing_address: detail.billing_address ?? null,
            raw_data: detail,
          };

          const { data: existing } = await adminClient
            .from("orders")
            .select("id, raw_data")
            .eq("external_order_id", externalOrderId)
            .eq("source_system", sourceSystem)
            .maybeSingle();

          // Skip if Zoho last_modified_time has not advanced since last import
          const incomingModified = (detail as any).last_modified_time ?? (so as any).last_modified_time ?? null;
          const existingModified = (existing?.raw_data as any)?.last_modified_time ?? null;
          if (existing && incomingModified && existingModified && incomingModified <= existingModified) {
            totalSkipped++;
            continue;
          }

          let orderId: string | null = null;
          if (existing) {
            const { error: updErr } = await adminClient.from("orders").update(orderPayload).eq("id", existing.id);
            if (updErr) {
              totalFailed++;
              errors.push({ id: externalOrderId, message: updErr.message });
              continue;
            }
            orderId = existing.id;
            totalUpdated++;
          } else {
            const { data: inserted, error: insErr } = await adminClient
              .from("orders").insert(orderPayload).select("id").single();
            if (insErr || !inserted) {
              totalFailed++;
              errors.push({ id: externalOrderId, message: insErr?.message ?? "insert failed" });
              continue;
            }
            orderId = inserted.id;
            totalImported++;
          }

          if (orderId && Array.isArray(detail.line_items)) {
            await syncLineItems(adminClient, orderId, detail.line_items, sourceSystem);
          }
        } catch (err: any) {
          totalFailed++;
          errors.push({ id: externalOrderId, message: err?.message ?? "unknown" });
        }

        await sleep(120);
      }

      if (!hasMore) break;
      page++;
      await sleep(500);
    }

    const durationMs = Date.now() - startTime;

    await adminClient.from("audit_logs").insert({
      user_id: null,
      action: "scheduled_order_sync",
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

    console.log(`[scheduled-order-sync] Done:`, JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[scheduled-order-sync] Fatal:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
