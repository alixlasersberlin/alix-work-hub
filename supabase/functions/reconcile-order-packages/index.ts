import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getZohoConfig(sourceSystem: string) {
  const map: Record<string, { prefix: string; accountsBase: string; apiBase: string }> = {
    zoho_eu_1: { prefix: "ZOHO_EU_1", accountsBase: "https://accounts.zoho.eu", apiBase: "https://www.zohoapis.eu/books/v3" },
    zoho_eu_2: { prefix: "ZOHO_EU_2", accountsBase: "https://accounts.zoho.eu", apiBase: "https://www.zohoapis.eu/books/v3" },
    zoho_us_1: { prefix: "ZOHO_US_1", accountsBase: "https://accounts.zoho.com", apiBase: "https://www.zohoapis.com/books/v3" },
  };
  const cfg = map[sourceSystem];
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

async function getAccessToken(cfg: any): Promise<string> {
  const res = await fetch(`${cfg.accountsBaseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: cfg.refreshToken,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Zoho token refresh failed: ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error("No access_token from Zoho");
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await admin.from("user_roles").select("roles!inner(name)").eq("user_id", user.id);
    const roleNames = (roles ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    if (!roleNames.includes("Admin") && !roleNames.includes("Super Admin") && !roleNames.includes("Auftragsverwaltung")) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const orderId: string = body.order_id;
    if (!orderId) return json({ error: "order_id required" }, 400);

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (oErr || !order) return json({ error: "Order not found" }, 404);

    const packages: any[] = Array.isArray(order.raw_data?.packages) ? order.raw_data.packages : [];
    if (packages.length === 0) return json({ error: "No packages on this order" }, 400);

    const cfg = getZohoConfig(order.source_system);
    if (!cfg) return json({ error: "Invalid source_system" }, 400);
    const token = await getAccessToken(cfg);

    // 1) For each package, fetch detail to get line_items
    const shippedByLineItem = new Map<string, number>(); // external_item_id -> qty shipped
    for (const p of packages) {
      const pid = p.package_id;
      if (!pid) continue;
      const res = await fetch(
        `${cfg.booksApiBaseUrl}/packages/${pid}?organization_id=${cfg.organizationId}`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
      );
      if (!res.ok) {
        const t = await res.text();
        return json({ error: "Zoho package detail failed", package_id: pid, message: t }, 502);
      }
      const data = await res.json();
      const pkg = data.package ?? {};
      const lineItems: any[] = Array.isArray(pkg.line_items) ? pkg.line_items : [];
      for (const li of lineItems) {
        const key = String(li.line_item_id ?? li.so_line_item_id ?? "");
        if (!key) continue;
        const qty = Number(li.quantity ?? 0);
        shippedByLineItem.set(key, (shippedByLineItem.get(key) ?? 0) + qty);
      }
    }

    // 2) Load order_items
    const { data: items, error: iErr } = await admin
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("item_order", { ascending: true });
    if (iErr) return json({ error: "DB items fetch failed", message: iErr.message }, 500);

    // 3) Compute remaining per item
    const remaining: any[] = [];
    const summary: any[] = [];
    for (const it of items ?? []) {
      const ordered = Number(it.quantity ?? 0);
      const shipped = shippedByLineItem.get(String(it.external_item_id ?? "")) ?? 0;
      const remain = Math.max(0, ordered - shipped);
      summary.push({
        item_name: it.item_name, sku: it.sku, ordered, shipped, remaining: remain,
        external_item_id: it.external_item_id,
      });
      if (remain > 0) {
        remaining.push({ ...it, remaining_qty: remain });
      }
    }

    // 4) Determine new order_number suffix (-1, -2, ...)
    const baseNumber = order.order_number;
    const { data: existingChildren } = await admin
      .from("orders")
      .select("order_number")
      .eq("source_system", order.source_system)
      .like("order_number", `${baseNumber}-%`);
    let nextSuffix = 1;
    const used = new Set((existingChildren ?? []).map((o: any) => o.order_number));
    while (used.has(`${baseNumber}-${nextSuffix}`)) nextSuffix++;
    const newOrderNumber = `${baseNumber}-${nextSuffix}`;

    let newOrderId: string | null = null;

    if (remaining.length > 0) {
      // 5) Create remainder order
      const newTotal = remaining.reduce((sum, r) => {
        const rate = Number(r.rate ?? 0);
        return sum + rate * Number(r.remaining_qty ?? 0);
      }, 0);

      const { data: newOrder, error: nErr } = await admin
        .from("orders")
        .insert({
          customer_id: order.customer_id,
          external_order_id: null,
          order_number: newOrderNumber,
          source_system: order.source_system,
          order_status: "offen",
          currency: order.currency,
          total_amount: newTotal,
          order_date: new Date().toISOString(),
          expected_shipment_date: null,
          billing_address: order.billing_address,
          shipping_address: order.shipping_address,
          raw_data: {
            generated_from: baseNumber,
            generated_from_order_id: order.id,
            generated_at: new Date().toISOString(),
            reason: "Restauftrag aus Paketabgleich",
          },
        })
        .select("id")
        .single();
      if (nErr || !newOrder) return json({ error: "Create remainder order failed", message: nErr?.message }, 500);
      newOrderId = newOrder.id;

      // Insert remainder items
      const newItemsPayload = remaining.map((r, idx) => ({
        order_id: newOrder.id,
        external_item_id: null, // not from Zoho
        item_name: r.item_name,
        description: r.description,
        sku: r.sku,
        quantity: r.remaining_qty,
        rate: r.rate,
        amount: Number(r.rate ?? 0) * Number(r.remaining_qty ?? 0),
        discount: 0,
        tax_amount: 0,
        unit: r.unit,
        item_order: idx,
        raw_data: { source_order_item_id: r.id, source_order_id: order.id },
      }));
      if (newItemsPayload.length > 0) {
        const { error: niErr } = await admin.from("order_items").insert(newItemsPayload);
        if (niErr) return json({ error: "Create remainder items failed", message: niErr.message }, 500);
      }
    }

    // 6) Mark original as delivered
    const { error: upErr } = await admin
      .from("orders")
      .update({ order_status: "geliefert", updated_at: new Date().toISOString() })
      .eq("id", order.id);
    if (upErr) return json({ error: "Update original order failed", message: upErr.message }, 500);

    await admin.from("order_status_history").insert({
      order_id: order.id,
      old_status: order.order_status,
      new_status: "geliefert",
      changed_by: user.id,
      change_note: remaining.length > 0
        ? `Paketabgleich: alle Pakete geliefert. Restartikel \u2192 ${newOrderNumber}`
        : `Paketabgleich: alle Artikel geliefert.`,
    });

    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "reconcile_order_packages",
      module: "order_management",
      record_id: order.id,
      details: {
        order_number: order.order_number,
        new_order_number: newOrderId ? newOrderNumber : null,
        new_order_id: newOrderId,
        summary,
      },
    });

    return json({
      success: true,
      summary,
      original_order_id: order.id,
      original_order_number: order.order_number,
      new_order_id: newOrderId,
      new_order_number: newOrderId ? newOrderNumber : null,
      remaining_items_count: remaining.length,
    });
  } catch (e: any) {
    console.error("reconcile-order-packages error:", e);
    return json({ error: "Internal error", message: e?.message ?? String(e) }, 500);
  }
});
