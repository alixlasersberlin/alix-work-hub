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
  limit?: number;
};

type ZohoConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  organizationId: string;
  accountsBaseUrl: string;
  booksApiBaseUrl: string;
};

type ManagedImportError = Error & {
  code?: string;
  fallback?: boolean;
  retryAfterSeconds?: number;
  retryable?: boolean;
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

// Simple in-memory token cache (per isolate lifetime)
const tokenCache: Record<string, { token: string; expiresAt: number }> = {};

const TOKEN_RETRY_DELAYS_MS = [1500, 4000];

function createManagedError(
  message: string,
  code: string,
  options: { fallback?: boolean; retryAfterSeconds?: number; retryable?: boolean } = {},
): ManagedImportError {
  const error = new Error(message) as ManagedImportError;
  error.code = code;
  error.fallback = options.fallback;
  error.retryAfterSeconds = options.retryAfterSeconds;
  error.retryable = options.retryable;
  return error;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonResponse(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

function isZohoRateLimitPayload(payload: Record<string, unknown>): boolean {
  const description = String(payload.error_description ?? "").toLowerCase();
  const error = String(payload.error ?? "").toLowerCase();
  return (
    description.includes("too many requests") ||
    description.includes("try again after some time") ||
    (error.includes("access denied") && description.length > 0)
  );
}

function buildGracefulErrorResponse(error: unknown): Response | null {
  const managedError = error as ManagedImportError;
  const message = managedError?.message ?? "Import temporarily unavailable";
  const normalizedMessage = message.toLowerCase();
  const isRetryable =
    managedError?.retryable === true ||
    managedError?.fallback === true ||
    managedError?.code === "ZOHO_RATE_LIMIT" ||
    normalizedMessage.includes("too many requests") ||
    normalizedMessage.includes("rate limit");

  if (!isRetryable) return null;

  return jsonResponse({
    success: false,
    fallback: true,
    retryable: true,
    error: "Zoho API-Limit erreicht",
    message,
    error_code: managedError?.code ?? "ZOHO_RATE_LIMIT",
    retry_after_seconds: managedError?.retryAfterSeconds ?? 90,
  });
}

async function getZohoAccessToken(config: ZohoConfig): Promise<string> {
  const cacheKey = `${config.clientId}_${config.organizationId}`;
  const cached = tokenCache[cacheKey];
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  for (let attempt = 0; attempt <= TOKEN_RETRY_DELAYS_MS.length; attempt++) {
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

    const responseText = await response.text();
    const data = parseJsonResponse(responseText);

    if (typeof data.access_token === "string" && data.access_token.length > 0) {
      tokenCache[cacheKey] = { token: data.access_token, expiresAt: Date.now() + 50 * 60 * 1000 };
      return data.access_token;
    }

    if (isZohoRateLimitPayload(data)) {
      if (attempt < TOKEN_RETRY_DELAYS_MS.length) {
        await sleep(TOKEN_RETRY_DELAYS_MS[attempt]);
        continue;
      }

      throw createManagedError(
        "Zoho blockiert gerade neue Token-Anfragen. Bitte in 1–2 Minuten erneut versuchen.",
        "ZOHO_RATE_LIMIT",
        { fallback: true, retryable: true, retryAfterSeconds: 90 },
      );
    }

    if (data.error === "invalid_code") {
      throw createManagedError("Zoho refresh token is invalid or revoked.", "ZOHO_REFRESH_TOKEN_INVALID");
    }

    throw new Error(`Zoho access token missing: ${JSON.stringify(data)}`);
  }

  throw createManagedError(
    "Zoho blockiert gerade neue Token-Anfragen. Bitte in 1–2 Minuten erneut versuchen.",
    "ZOHO_RATE_LIMIT",
    { fallback: true, retryable: true, retryAfterSeconds: 90 },
  );
}

function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
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

function hasOrderChanged(
  existing: { order_status?: string | null; currency?: string | null; total_amount?: number | null; order_date?: string | null; expected_shipment_date?: string | null; billing_address?: unknown; shipping_address?: unknown },
  incoming: { order_status?: string | null; currency?: string | null; total_amount?: number | null; order_date?: string | null; expected_shipment_date?: string | null; billing_address?: unknown; shipping_address?: unknown },
): boolean {
  return (
    (existing.order_status ?? null) !== (incoming.order_status ?? null) ||
    (existing.currency ?? null) !== (incoming.currency ?? null) ||
    Number(existing.total_amount ?? 0) !== Number(incoming.total_amount ?? 0) ||
    (existing.order_date ?? null) !== (incoming.order_date ?? null) ||
    (existing.expected_shipment_date ?? null) !== (incoming.expected_shipment_date ?? null) ||
    !jsonEqual(existing.billing_address, incoming.billing_address) ||
    !jsonEqual(existing.shipping_address, incoming.shipping_address)
  );
}

async function syncLineItems(adminClient: any, orderId: string, lineItems: any[]) {
  if (!lineItems || lineItems.length === 0) return;

  for (let i = 0; i < lineItems.length; i++) {
    const li = lineItems[i];
    const externalItemId = li.line_item_id?.toString() || li.item_id?.toString() || null;

    const itemPayload = {
      order_id: orderId,
      external_item_id: externalItemId,
      item_name: li.name ?? li.item_name ?? null,
      description: li.description ?? null,
      sku: li.sku ?? li.item_code ?? null,
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
      // Upsert by order_id + external_item_id
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

  // Remove items that no longer exist in Zoho
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

    // Auth check – scheduled calls use service role key directly
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const isScheduledCall = authHeader === `Bearer ${serviceRoleKey}`;
    let userId: string | null = null;

    if (isScheduledCall) {
      userId = "system-scheduled";
    } else {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

      const { data: callerRoles } = await adminClient
        .from("user_roles").select("roles!inner(name)").eq("user_id", user.id);
      const roleNames = (callerRoles ?? []).map((row: any) => row.roles?.name).filter(Boolean);
      const isAdmin = roleNames.includes("Admin") || roleNames.includes("Super Admin");
      if (!isAdmin) return jsonResponse({ error: "Forbidden" }, 403);
      userId = user.id;
    }

    const body = (await req.json()) as ImportPayload;
    const sourceSystem = body.source_system;
    const mode = body.mode ?? "manual";
    const isDryRun = mode === "dry_run";
    const entity = body.entity ?? "contacts"; // "contacts" or "salesorders"
    const page = body.page ?? 1;
    const limit = body.limit && body.limit > 0 ? body.limit : null; // null = no limit

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
    let items = json[apiKey] ?? [];
    const hasMore = json.page_context?.has_more_page === true;

    // Apply limit: truncate items if limit is set
    if (limit !== null && items.length > limit) {
      items = items.slice(0, limit);
    }

    // Process items
    let imported = 0;
    let skipped = 0;
    let updated = 0;
    let failed = 0;
    const dryRunResults: { type: string; id: string; action: string; name?: string }[] = [];
    const errors: { type: string; id: string; message: string }[] = [];

    if (entity === "contacts") {
      for (const contact of items) {
        try {
          const externalId = contact.contact_id?.toString();
          if (!externalId) { skipped++; continue; }

          // Fetch contact detail to get billing/shipping addresses
          let contactDetail = contact;
          try {
            const detailUrl = `${zohoConfig.booksApiBaseUrl}/contacts/${externalId}?organization_id=${zohoConfig.organizationId}`;
            console.log(`Fetching contact detail: ${detailUrl}`);
            const detailRes = await fetch(detailUrl, {
              headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
            });
            console.log(`Detail response status: ${detailRes.status}`);
            if (detailRes.ok) {
              const detailJson = await detailRes.json();
              if (detailJson.contact) {
                contactDetail = detailJson.contact;
                console.log(`Contact ${externalId} has billing_address: ${JSON.stringify(contactDetail.billing_address ?? null)}`);
              } else {
                console.warn(`Detail response for ${externalId} has no contact key. Keys: ${Object.keys(detailJson).join(", ")}`);
              }
            } else {
              const errText = await detailRes.text();
              console.warn(`Detail fetch failed for ${externalId}: ${detailRes.status} - ${errText.substring(0, 200)}`);
            }
          } catch (detailErr: any) {
            console.warn(`Could not fetch detail for contact ${externalId}: ${detailErr?.message}`);
          }

          const customerPayload = {
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
            .from("customers").select("id, company_name, contact_name, email, phone, billing_address, shipping_address")
            .eq("external_customer_id", externalId)
            .eq("source_system", sourceSystem)
            .maybeSingle();

          if (isDryRun) {
            if (existing) {
              const changed = hasCustomerChanged(existing, customerPayload);
              dryRunResults.push({
                type: "customer", id: externalId,
                action: changed ? "update" : "skip",
                name: contact.company_name || contact.contact_name || undefined,
              });
              if (changed) updated++; else skipped++;
            } else {
              dryRunResults.push({
                type: "customer", id: externalId,
                action: "create",
                name: contact.company_name || contact.contact_name || undefined,
              });
              imported++;
            }
            continue;
          }

          if (existing) {
            if (!hasCustomerChanged(existing, customerPayload)) {
              skipped++;
            } else {
              const { error: updateError } = await adminClient
                .from("customers")
                .update({
                  company_name: customerPayload.company_name,
                  contact_name: customerPayload.contact_name,
                  email: customerPayload.email,
                  phone: customerPayload.phone,
                  billing_address: customerPayload.billing_address,
                  shipping_address: customerPayload.shipping_address,
                  raw_data: customerPayload.raw_data,
                })
                .eq("id", existing.id);
              if (updateError) {
                failed++;
                errors.push({ type: "customer", id: externalId, message: updateError.message });
              } else {
                updated++;
              }
            }
          } else {
            const { error: insertError } = await adminClient.from("customers").insert(customerPayload);
            if (insertError) {
              failed++;
              errors.push({ type: "customer", id: externalId, message: insertError.message });
            } else {
              imported++;
            }
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
            .from("orders").select("id, order_status, currency, total_amount, order_date, expected_shipment_date, billing_address, shipping_address")
            .eq("order_number", orderNumber)
            .eq("source_system", sourceSystem)
            .maybeSingle();

          // Fetch order detail for billing/shipping addresses
          let orderDetail = order;
          try {
            const detailRes = await fetch(
              `${zohoConfig.booksApiBaseUrl}/salesorders/${externalOrderId}?organization_id=${zohoConfig.organizationId}`,
              { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } },
            );
            if (detailRes.ok) {
              const detailJson = await detailRes.json();
              if (detailJson.salesorder) orderDetail = detailJson.salesorder;
            }
          } catch (e: any) {
            console.warn(`Detail fetch failed for order ${externalOrderId}: ${e?.message}`);
          }

          if (isDryRun) {
            dryRunResults.push({
              type: "order", id: orderNumber,
              action: existingOrder ? "update" : "create",
              name: order.customer_name || undefined,
            });
            if (existingOrder) skipped++; else imported++;
            continue;
          }

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

          const orderDateIso = orderDetail.date ? new Date(orderDetail.date).toISOString() : null;
          let expectedShipmentDate: string | null = null;
          if (orderDetail.shipment_date) {
            expectedShipmentDate = new Date(orderDetail.shipment_date).toISOString();
          } else {
            const fallback = new Date();
            fallback.setDate(fallback.getDate() + 56);
            expectedShipmentDate = fallback.toISOString();
          }

          const orderPayload = {
            customer_id: dbCustomer.id,
            external_order_id: externalOrderId,
            order_number: orderNumber,
            source_system: sourceSystem,
            order_status: orderDetail.status ?? "offen",
            currency: orderDetail.currency_code ?? null,
            total_amount: orderDetail.total ?? null,
            order_date: orderDateIso,
            expected_shipment_date: expectedShipmentDate,
            billing_address: orderDetail.billing_address ?? null,
            shipping_address: orderDetail.shipping_address ?? null,
            raw_data: orderDetail,
          };

          if (existingOrder) {
            // Check if anything changed
            if (!hasOrderChanged(existingOrder, orderPayload)) {
              // Still sync line items even if order header unchanged
              await syncLineItems(adminClient, existingOrder.id, orderDetail.line_items ?? []);
              skipped++;
              continue;
            }
            const { error: updateError } = await adminClient
              .from("orders")
              .update({
                order_status: orderPayload.order_status,
                currency: orderPayload.currency,
                total_amount: orderPayload.total_amount,
                order_date: orderPayload.order_date,
                expected_shipment_date: orderPayload.expected_shipment_date,
                billing_address: orderPayload.billing_address,
                shipping_address: orderPayload.shipping_address,
                raw_data: orderPayload.raw_data,
                customer_id: orderPayload.customer_id,
              })
              .eq("id", existingOrder.id);
            if (updateError) {
              failed++;
              errors.push({ type: "order", id: orderNumber, message: updateError.message });
            } else {
              await syncLineItems(adminClient, existingOrder.id, orderDetail.line_items ?? []);
              updated++;
            }
          } else {
            const { data: newOrder, error: orderError } = await adminClient
              .from("orders").insert(orderPayload).select("id").single();
            if (orderError || !newOrder) {
              failed++;
              errors.push({ type: "order", id: orderNumber, message: orderError?.message ?? "Insert failed" });
            } else {
              await syncLineItems(adminClient, newOrder.id, orderDetail.line_items ?? []);
              imported++;
            }
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
        user_id: isScheduledCall ? null : userId,
        action: isDryRun ? "dry_run_zoho_import" : "start_zoho_import",
        module: "import_management",
        details: { source_system: sourceSystem, mode, entity, job_id: body.job_id, scheduled: isScheduledCall },
      });
    }

    // Log import summary to order_import_logs (one entry per page/call)
    try {
      const importedByUser = isScheduledCall ? null : (userId && userId !== "system-scheduled" ? userId : null);
      const summaryParts = [
        `${entity === "contacts" ? "Kunden" : "Aufträge"} Seite ${page}`,
        `${items.length} geladen`,
        `${imported} neu`,
        `${updated} aktualisiert`,
        `${skipped} übersprungen`,
        `${failed} Fehler`,
      ];
      if (isDryRun) summaryParts.unshift("DRY-RUN");
      if (isScheduledCall) summaryParts.unshift("Scheduled");
      if (body.job_id) summaryParts.push(`Job ${body.job_id}`);

      await adminClient.from("order_import_logs").insert({
        source_system: sourceSystem,
        import_status: failed > 0 ? (imported + updated > 0 ? "partial" : "failed") : "success",
        message: summaryParts.join(" · "),
        imported_by: importedByUser,
      });

      // Per-error detail entries (cap to avoid log spam)
      const maxErrorLogs = 25;
      for (const e of errors.slice(0, maxErrorLogs)) {
        await adminClient.from("order_import_logs").insert({
          source_system: sourceSystem,
          import_status: "failed",
          order_number: e.type === "order" ? e.id : null,
          external_order_id: e.type === "order" ? e.id : null,
          external_customer_id: e.type === "customer" ? e.id : null,
          message: `${e.type}: ${e.message}`.slice(0, 1000),
          imported_by: importedByUser,
        });
      }
    } catch (logErr: any) {
      console.warn("Failed to write order_import_logs:", logErr?.message);
    }

    return jsonResponse({
      success: true,
      entity,
      page,
      has_more: limit !== null ? false : hasMore,
      items_fetched: items.length,
      imported,
      updated,
      skipped,
      failed,
      ...(isDryRun && dryRunResults.length > 0 ? { dry_run_results: dryRunResults } : {}),
      ...(errors.length > 0 ? { errors } : {}),
    });

  } catch (error: any) {
    console.error("start-zoho-import error:", error);
    const gracefulResponse = buildGracefulErrorResponse(error);
    if (gracefulResponse) {
      return gracefulResponse;
    }
    return jsonResponse({ error: error?.message ?? "Internal server error" }, 500);
  }
});
