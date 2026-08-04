// Importiert Gutschriften (Credit Notes) aus Zoho Books – alle Status, seitenweise resumable.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  source_system?: "zoho_eu_1" | "zoho_eu_2";
  date_from?: string;
  page?: number;
  per_page?: number;
  max_pages?: number;
};

const CH_BRANCH_ID = "116240000000287001";

function detectRegion(x: any): "EU" | "CH" {
  if (x?.branch_id && String(x.branch_id) === CH_BRANCH_ID) return "CH";
  if ((x?.currency_code ?? "").toString().toUpperCase() === "CHF") return "CH";
  const country = (x?.billing_address?.country ?? "").toString().toLowerCase();
  if (country === "ch" || country.includes("schweiz") || country.includes("switzerland")) return "CH";
  return "EU";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getZohoConfig(source: string) {
  if (source !== "zoho_eu_1" && source !== "zoho_eu_2") return null;
  const getEnv = (key: string) => (Deno.env.get(key) ?? "").trim();
  return {
    clientId: getEnv("ZOHO_EU_1_CLIENT_ID"),
    clientSecret: getEnv("ZOHO_EU_1_CLIENT_SECRET"),
    refreshToken: getEnv("ZOHO_EU_1_REFRESH_TOKEN"),
    organizationId: getEnv(`${source === "zoho_eu_2" ? "ZOHO_EU_2" : "ZOHO_EU_1"}_ORGANIZATION_ID`),
    accountsBaseUrl: "https://accounts.zoho.eu",
    booksApiBaseUrl: "https://www.zohoapis.eu/books/v3",
  };
}

async function getAccessToken(cfg: NonNullable<ReturnType<typeof getZohoConfig>>) {
  if (!cfg.clientId || !cfg.clientSecret || !cfg.refreshToken || !cfg.organizationId) {
    throw new Error("Zoho-Konfiguration unvollständig");
  }
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
  if (!data?.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data).substring(0, 300)}`);
  return data.access_token as string;
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
    const dateFrom = body.date_from ?? "2010-01-01";
    const perPage = Math.min(Math.max(body.per_page ?? 200, 1), 200);
    const startPage = Math.max(1, body.page ?? 1);
    const maxPages = Math.min(Math.max(body.max_pages ?? 3, 1), 20);

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
      const url = `${cfg.booksApiBaseUrl}/creditnotes?organization_id=${cfg.organizationId}` +
        `&page=${page}&per_page=${perPage}&date_after=${dateFrom}` +
        `&filter_by=Status.All&sort_column=date&sort_order=A`;
      const res = await fetch(url, { headers: authH });
      if (!res.ok) {
        const t = await res.text();
        return json({ error: `Zoho creditnotes page ${page}: ${t.substring(0, 400)}` }, 502);
      }
      const data = await res.json();
      const list: any[] = data.creditnotes ?? [];
      hasMore = data.page_context?.has_more_page === true;

      for (const cn of list) {
        processed++;
        const cnId = String(cn.creditnote_id ?? "");
        if (!cnId) { failed++; continue; }
        const payload = {
          source_system: sourceSystem,
          zoho_creditnote_id: cnId,
          creditnote_number: cn.creditnote_number ?? null,
          reference_number: cn.reference_number ?? null,
          customer_id: cn.customer_id ? String(cn.customer_id) : null,
          customer_name: cn.customer_name ?? null,
          creditnote_date: cn.date || null,
          status: cn.status ?? null,
          currency: cn.currency_code ?? null,
          total: cn.total != null ? Number(cn.total) : null,
          balance: cn.balance != null ? Number(cn.balance) : null,
          accounting_region: detectRegion(cn),
          raw_data: cn,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { data: existing } = await admin
          .from("zoho_credit_notes")
          .select("id")
          .eq("source_system", sourceSystem)
          .eq("zoho_creditnote_id", cnId)
          .maybeSingle();
        if (existing) {
          const { error } = await admin.from("zoho_credit_notes").update(payload).eq("id", existing.id);
          if (error) { console.error("credit note update failed:", error.message); failed++; } else updated++;
        } else {
          const { error } = await admin.from("zoho_credit_notes").insert(payload);
          if (error) { console.error("credit note insert failed:", error.message); failed++; } else imported++;
        }
      }
      page++;
    }

    return json({
      success: true,
      imported, updated, failed, processed,
      last_page: page - 1,
      next_page: page,
      has_more: hasMore,
    });
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
});
