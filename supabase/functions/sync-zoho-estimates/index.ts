// Sync Zoho Books "Estimates" (Angebote) into public.offers
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  source_system?: "zoho_eu_1" | "zoho_eu_2";
  date_from?: string;
  date_to?: string;
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
  };
  const c = map[source];
  if (!c) return null;
  const env = (k: string) => (Deno.env.get(k) ?? "").trim();
  return {
    clientId: source === "zoho_eu_2" ? env("ZOHO_EU_1_CLIENT_ID") : env(`${c.prefix}_CLIENT_ID`),
    clientSecret: source === "zoho_eu_2" ? env("ZOHO_EU_1_CLIENT_SECRET") : env(`${c.prefix}_CLIENT_SECRET`),
    refreshToken: source === "zoho_eu_2" ? env("ZOHO_EU_1_REFRESH_TOKEN") : env(`${c.prefix}_REFRESH_TOKEN`),
    organizationId: env(`${c.prefix}_ORGANIZATION_ID`),
    accountsBaseUrl: c.accountsBase,
    booksApiBaseUrl: c.apiBase,
  };
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getAccessToken(cfg: ReturnType<typeof getZohoConfig>) {
  if (!cfg) throw new Error("Zoho config missing");
  const key = `${cfg.accountsBaseUrl}|${cfg.clientId}|${cfg.refreshToken}`;
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  for (let attempt = 0; attempt < 4; attempt++) {
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
    if (data?.access_token) {
      tokenCache.set(key, { token: data.access_token, expiresAt: Date.now() + ((data.expires_in ?? 3600) * 1000) });
      return data.access_token as string;
    }
    if ((data?.error_description ?? "").toString().toLowerCase().includes("too many requests")) {
      await sleep(3000 * (attempt + 1));
      continue;
    }
    throw new Error(`Zoho token error: ${JSON.stringify(data)}`);
  }
  throw new Error("Zoho token: exceeded retries");
}

function statusMap(s: string): "draft" | "signed" | "order" {
  const v = (s ?? "").toLowerCase();
  if (v === "accepted" || v === "invoiced") return "order";
  if (v === "sent" || v === "viewed") return "signed";
  return "draft";
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
    const dateFrom = body.date_from;
    const dateTo = body.date_to;
    const perPage = Math.min(Math.max(body.per_page ?? 100, 1), 200);
    const startPage = body.page ?? 1;
    const maxPages = Math.min(Math.max(body.max_pages ?? 3, 1), 10);

    const cfg = getZohoConfig(sourceSystem);
    if (!cfg) return json({ error: "Invalid source_system" }, 400);

    const token = await getAccessToken(cfg);
    const authH = { Authorization: `Zoho-oauthtoken ${token}` };
    const isAT = sourceSystem === "zoho_eu_2";
    const suffix = isAT ? "-AT" : "";

    let page = startPage;
    let hasMore = true;
    let fetched = 0, imported = 0, updated = 0, failed = 0;
    const errors: { id: string; message: string }[] = [];

    for (let i = 0; i < maxPages && hasMore; i++, page++) {
      const params = new URLSearchParams({
        organization_id: cfg.organizationId,
        page: String(page),
        per_page: String(perPage),
        sort_column: "date",
        sort_order: "D",
      });
      if (dateFrom) params.set("date_start", dateFrom);
      if (dateTo) params.set("date_end", dateTo);
      const url = `${cfg.booksApiBaseUrl}/estimates?${params.toString()}`;
      const res = await fetch(url, { headers: authH });
      if (!res.ok) {
        const txt = await res.text();
        return json({ success: false, error: `Zoho estimates fetch failed: ${res.status}`, details: txt }, 500);
      }
      const data = await res.json();
      const list: any[] = data.estimates ?? [];
      fetched += list.length;
      hasMore = data.page_context?.has_more_page === true;

      for (const est of list) {
        try {
          // Fetch full estimate for line items
          let full: any = est;
          try {
            const detRes = await fetch(`${cfg.booksApiBaseUrl}/estimates/${est.estimate_id}?organization_id=${cfg.organizationId}`, { headers: authH });
            if (detRes.ok) {
              const dj = await detRes.json();
              full = dj.estimate ?? est;
            }
          } catch { /* ignore, fall back to list row */ }

          const offerNumber = `${est.estimate_number}${suffix}`;
          const net = Number(full.sub_total ?? 0);
          const tax = Number(full.tax_total ?? 0);
          const gross = Number(full.total ?? net + tax);

          // Try to link to existing customer via zoho contact id
          let customerId: string | null = null;
          if (est.customer_id) {
            const { data: cust } = await admin
              .from("customers")
              .select("id")
              .eq("source_system", sourceSystem)
              .eq("external_customer_id", String(est.customer_id))
              .maybeSingle();
            customerId = cust?.id ?? null;
          }

          const payload = {
            offerNumber,
            offerDate: full.date ?? est.date ?? null,
            validUntil: full.expiry_date ?? est.expiry_date ?? null,
            customer: {
              id: customerId,
              company_name: est.customer_name ?? null,
              email: full.email ?? est.email ?? null,
              phone: full.phone ?? null,
            },
            totals: { net, tax, gross },
            lines: (full.line_items ?? []).map((li: any) => ({
              sku: li.sku ?? null,
              name: li.name ?? li.description ?? null,
              description: li.description ?? null,
              quantity: Number(li.quantity ?? 0),
              unit_price: Number(li.rate ?? 0),
              tax_percent: Number(li.tax_percentage ?? 0),
              total: Number(li.item_total ?? 0),
            })),
            notes: full.notes ?? null,
            createdAt: est.created_time ?? null,
            zoho: {
              source_system: sourceSystem,
              estimate_id: est.estimate_id,
              estimate_number: est.estimate_number,
              status: est.status,
              reference_number: est.reference_number ?? null,
            },
          };

          const row: any = {
            offer_number: offerNumber,
            offer_date: payload.offerDate,
            valid_until: payload.validUntil,
            customer_id: customerId,
            customer_name: est.customer_name ?? null,
            customer_email: payload.customer.email ?? null,
            total_net: net,
            total_tax: tax,
            total_gross: gross,
            status: statusMap(est.status),
            payload,
            created_by_name: `Zoho ${isAT ? "AT" : "DE"}`,
          };

          const { data: existing } = await admin
            .from("offers").select("id").eq("offer_number", offerNumber).maybeSingle();

          if (existing) {
            const { error } = await admin.from("offers").update(row).eq("offer_number", offerNumber);
            if (error) throw error;
            updated++;
          } else {
            const { error } = await admin.from("offers").insert(row);
            if (error) throw error;
            imported++;
          }
        } catch (e: any) {
          failed++;
          errors.push({ id: est.estimate_id, message: e?.message ?? String(e) });
        }
      }
    }

    return json({
      success: true,
      source_system: sourceSystem,
      fetched, imported, updated, failed,
      last_page: page - 1,
      has_more: hasMore,
      errors: errors.slice(0, 10),
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message ?? String(e) }, 500);
  }
});
