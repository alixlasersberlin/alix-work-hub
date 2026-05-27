import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  source_system?: "zoho_eu_1" | "zoho_eu_2" | "zoho_us_1";
  page?: number;
  per_page?: number;
  max_pages?: number;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getZohoConfig(source: string) {
  const map: Record<string, { prefix: string; accountsBase: string; apiBase: string }> = {
    zoho_eu_1: { prefix: "ZOHO_EU_1", accountsBase: "https://accounts.zoho.eu", apiBase: "https://www.zohoapis.eu/books/v3" },
    zoho_eu_2: { prefix: "ZOHO_EU_2", accountsBase: "https://accounts.zoho.eu", apiBase: "https://www.zohoapis.eu/books/v3" },
    zoho_us_1: { prefix: "ZOHO_US_1", accountsBase: "https://accounts.zoho.com", apiBase: "https://www.zohoapis.com/books/v3" },
  };
  const c = map[source];
  if (!c) return null;
  const env = (k: string) => (Deno.env.get(k) ?? "").trim();
  return {
    clientId: (source === "zoho_eu_2" ? env("ZOHO_EU_1_CLIENT_ID") : env(`${c.prefix}_CLIENT_ID`)),
    clientSecret: (source === "zoho_eu_2" ? env("ZOHO_EU_1_CLIENT_SECRET") : env(`${c.prefix}_CLIENT_SECRET`)),
    refreshToken: (source === "zoho_eu_2" ? env("ZOHO_EU_1_REFRESH_TOKEN") : env(`${c.prefix}_REFRESH_TOKEN`)),
    organizationId: env(`${c.prefix}_ORGANIZATION_ID`),
    accountsBaseUrl: c.accountsBase,
    booksApiBaseUrl: c.apiBase,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getAccessToken(cfg: ReturnType<typeof getZohoConfig>) {
  if (!cfg) throw new Error("Zoho config missing");
  for (let attempt = 0; attempt < 3; attempt++) {
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
    const data = await res.json();
    if (data?.access_token) return data.access_token as string;
    if ((data?.error_description ?? "").toString().toLowerCase().includes("too many requests")) {
      await sleep(3000 * (attempt + 1));
      continue;
    }
    throw new Error(`Zoho token error: ${JSON.stringify(data)}`);
  }
  throw new Error("Zoho token: rate limited");
}

function toTs(v: any): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    if (authHeader !== `Bearer ${serviceKey}`) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      const { data: roleRows } = await admin.from("user_roles").select("roles!inner(name)").eq("user_id", user.id);
      const names = (roleRows ?? []).map((r: any) => r.roles?.name);
      if (!names.includes("Admin") && !names.includes("Super Admin")) return json({ error: "Forbidden" }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Payload;
    const sourceSystem = body.source_system ?? "zoho_eu_1";
    const perPage = Math.min(Math.max(body.per_page ?? 200, 1), 200);
    const startPage = body.page ?? 1;
    const maxPages = Math.min(Math.max(body.max_pages ?? 50, 1), 100);

    const cfg = getZohoConfig(sourceSystem);
    if (!cfg) return json({ error: "Invalid source_system" }, 400);

    const token = await getAccessToken(cfg);
    const authH = { Authorization: `Zoho-oauthtoken ${token}` };

    let imported = 0, updated = 0, failed = 0, processed = 0;
    let page = startPage;
    let hasMore = true;
    const startedAt = Date.now();
    const SOFT_DEADLINE_MS = 60_000;

    while (hasMore && page <= startPage + maxPages - 1) {
      if (Date.now() - startedAt > SOFT_DEADLINE_MS) break;
      const url = `${cfg.booksApiBaseUrl}/items?organization_id=${cfg.organizationId}&page=${page}&per_page=${perPage}`;
      const r = await fetch(url, { headers: authH });
      if (!r.ok) {
        const t = await r.text();
        return json({ error: `Zoho items error page ${page}: ${t.substring(0, 400)}` }, 502);
      }
      const d = await r.json();
      const items: any[] = d.items ?? [];
      hasMore = d.page_context?.has_more_page === true;

      for (const it of items) {
        processed++;
        try {
          const itemId = String(it.item_id);
          const payload = {
            source_system: sourceSystem,
            zoho_item_id: itemId,
            name: it.name ?? it.item_name ?? null,
            sku: it.sku ?? null,
            description: it.description ?? null,
            unit: it.unit ?? null,
            rate: it.rate != null ? Number(it.rate) : null,
            purchase_rate: it.purchase_rate != null ? Number(it.purchase_rate) : null,
            currency_code: it.currency_code ?? null,
            status: it.status ?? null,
            product_type: it.product_type ?? null,
            item_type: it.item_type ?? null,
            tax_id: it.tax_id ? String(it.tax_id) : null,
            tax_name: it.tax_name ?? null,
            tax_percentage: it.tax_percentage != null ? Number(it.tax_percentage) : null,
            stock_on_hand: it.stock_on_hand != null ? Number(it.stock_on_hand) : null,
            available_stock: it.available_stock != null ? Number(it.available_stock) : null,
            actual_available_stock: it.actual_available_stock != null ? Number(it.actual_available_stock) : null,
            category_name: it.category_name ?? null,
            brand: it.brand ?? null,
            manufacturer: it.manufacturer ?? null,
            image_name: it.image_name ?? null,
            image_type: it.image_type ?? null,
            zoho_created_time: toTs(it.created_time),
            zoho_last_modified_time: toTs(it.last_modified_time),
            raw_data: it,
            synced_at: new Date().toISOString(),
          };

          const { data: existing } = await admin.from("zoho_items").select("id")
            .eq("source_system", sourceSystem).eq("zoho_item_id", itemId).maybeSingle();
          if (existing) {
            const { error } = await admin.from("zoho_items").update(payload).eq("id", existing.id);
            if (error) throw error;
            updated++;
          } else {
            const { error } = await admin.from("zoho_items").insert(payload);
            if (error) throw error;
            imported++;
          }
        } catch (e: any) {
          console.error("Item sync failed:", e?.message);
          failed++;
        }
      }
      page++;
    }

    return json({
      success: true, imported, updated, failed, processed,
      last_page: page - 1, has_more: hasMore,
      hint: hasMore ? `Mehr Artikel vorhanden — erneut mit page=${page}` : undefined,
    });
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
});
