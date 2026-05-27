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
    clientId: Deno.env.get(`${cfg.prefix}_CLIENT_ID`) || (sourceSystem === "zoho_eu_2" ? Deno.env.get("ZOHO_EU_1_CLIENT_ID") ?? "" : ""),
    clientSecret: Deno.env.get(`${cfg.prefix}_CLIENT_SECRET`) || (sourceSystem === "zoho_eu_2" ? Deno.env.get("ZOHO_EU_1_CLIENT_SECRET") ?? "" : ""),
    refreshToken: Deno.env.get(`${cfg.prefix}_REFRESH_TOKEN`) || (sourceSystem === "zoho_eu_2" ? Deno.env.get("ZOHO_EU_1_REFRESH_TOKEN") ?? "" : ""),
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
    const cronHeader = req.headers.get("x-cron-secret");
    const isCron = !!cronHeader && cronHeader === Deno.env.get("CRON_SECRET");

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (!isCron) {
      if (!authHeader) return json({ error: "Missing authorization header" }, 401);
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: { user }, error: uErr } = await userClient.auth.getUser();
      if (uErr || !user) return json({ error: "Unauthorized" }, 401);

      const { data: roles } = await admin.from("user_roles").select("roles!inner(name)").eq("user_id", user.id);
      const roleNames = (roles ?? []).map((r: any) => r.roles?.name).filter(Boolean);
      if (!roleNames.includes("Admin") && !roleNames.includes("Super Admin")) {
        return json({ error: "Forbidden" }, 403);
      }
    }

    const body = await req.json().catch(() => ({}));
    const sourceSystem: string = body.source_system ?? "zoho_eu_1";
    const dateFrom: string | null = body.date_from ?? null; // optional YYYY-MM-DD
    const perPage: number = Math.min(200, Number(body.per_page ?? 200));
    const maxPages: number = Math.min(200, Number(body.max_pages ?? 200));

    const cfg = getZohoConfig(sourceSystem);
    if (!cfg) return json({ error: "Invalid source_system" }, 400);
    const token = await getAccessToken(cfg);

    // 1) Fetch all packages, paginated
    const allPackages: any[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= maxPages) {
      const params = new URLSearchParams({
        organization_id: cfg.organizationId,
        per_page: String(perPage),
        page: String(page),
        sort_column: "created_time",
        sort_order: "D",
      });
      if (dateFrom) params.set("date_start", dateFrom);
      const res = await fetch(`${cfg.booksApiBaseUrl}/packages?${params.toString()}`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      });
      if (!res.ok) {
        const t = await res.text();
        return json({ error: "Zoho packages list failed", message: t, page }, 502);
      }
      const data = await res.json();
      const items = Array.isArray(data.packages) ? data.packages : [];
      allPackages.push(...items);
      hasMore = !!data.page_context?.has_more_page;
      page += 1;
    }

    // 2) Group packages by salesorder_number
    const bySalesorder = new Map<string, any[]>();
    for (const p of allPackages) {
      const sn = p.salesorder_number;
      if (!sn) continue;
      const arr = bySalesorder.get(sn) ?? [];
      arr.push(p);
      bySalesorder.set(sn, arr);
    }

    // 3) For each order in DB matching, merge packages into raw_data.packages
    let updated = 0;
    let missing = 0;
    const orderNumbers = Array.from(bySalesorder.keys());
    // chunk to avoid URL length issues
    const chunkSize = 200;
    const dbOrders: { id: string; order_number: string; raw_data: any }[] = [];
    for (let i = 0; i < orderNumbers.length; i += chunkSize) {
      const chunk = orderNumbers.slice(i, i + chunkSize);
      const { data, error } = await admin
        .from("orders")
        .select("id, order_number, raw_data")
        .eq("source_system", sourceSystem)
        .in("order_number", chunk);
      if (error) return json({ error: "DB fetch failed", message: error.message }, 500);
      dbOrders.push(...((data as any[]) ?? []));
    }
    const foundOrderNumbers = new Set(dbOrders.map((o) => o.order_number));
    missing = orderNumbers.filter((n) => !foundOrderNumbers.has(n)).length;

    for (const ord of dbOrders) {
      const incoming = bySalesorder.get(ord.order_number) ?? [];
      const existing: any[] = Array.isArray(ord.raw_data?.packages) ? ord.raw_data.packages : [];
      // Merge by package_id (incoming wins)
      const map = new Map<string, any>();
      for (const p of existing) if (p?.package_id) map.set(String(p.package_id), p);
      for (const p of incoming) {
        const id = String(p.package_id);
        const prev = map.get(id) ?? {};
        map.set(id, { ...prev, ...p });
      }
      const merged = Array.from(map.values()).sort((a, b) =>
        String(a.package_number ?? "").localeCompare(String(b.package_number ?? ""))
      );
      const newRaw = { ...(ord.raw_data ?? {}), packages: merged };
      const { error: upErr } = await admin
        .from("orders")
        .update({ raw_data: newRaw, updated_at: new Date().toISOString() })
        .eq("id", ord.id);
      if (upErr) return json({ error: "DB update failed", order_number: ord.order_number, message: upErr.message }, 500);
      updated += 1;
    }

    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "sync_zoho_packages",
      module: "import_management",
      details: {
        source_system: sourceSystem,
        packages_fetched: allPackages.length,
        salesorders_with_packages: bySalesorder.size,
        orders_updated: updated,
        orders_missing_in_db: missing,
        pages_fetched: page - 1,
      },
    });

    return json({
      success: true,
      packages_fetched: allPackages.length,
      salesorders_with_packages: bySalesorder.size,
      orders_updated: updated,
      orders_missing_in_db: missing,
      pages_fetched: page - 1,
    });
  } catch (e: any) {
    console.error("sync-zoho-packages error:", e);
    return json({ error: "Internal error", message: e?.message ?? String(e) }, 500);
  }
});
