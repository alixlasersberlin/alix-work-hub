import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  source_system?: "zoho_eu_1" | "zoho_eu_2";
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
  const getEnv = (key: string) => (Deno.env.get(key) ?? "").trim();
  return {
    clientId: (source === "zoho_eu_2" ? getEnv("ZOHO_EU_1_CLIENT_ID") : getEnv(`${c.prefix}_CLIENT_ID`)),
    clientSecret: (source === "zoho_eu_2" ? getEnv("ZOHO_EU_1_CLIENT_SECRET") : getEnv(`${c.prefix}_CLIENT_SECRET`)),
    refreshToken: (source === "zoho_eu_2" ? getEnv("ZOHO_EU_1_REFRESH_TOKEN") : getEnv(`${c.prefix}_REFRESH_TOKEN`)),
    organizationId: getEnv(`${c.prefix}_ORGANIZATION_ID`),
    accountsBaseUrl: c.accountsBase,
    booksApiBaseUrl: c.apiBase,
  };
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(cfg: ReturnType<typeof getZohoConfig>) {
  if (!cfg) throw new Error("Zoho config missing");
  if (!cfg.clientId || !cfg.clientSecret || !cfg.refreshToken || !cfg.organizationId) {
    throw new Error("Zoho config incomplete for selected source system");
  }
  const key = `${cfg.accountsBaseUrl}|${cfg.clientId}|${cfg.refreshToken}`;
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

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
  if (!data?.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data)}`);
  const ttl = ((data.expires_in ?? 3600) as number) * 1000;
  tokenCache.set(key, { token: data.access_token, expiresAt: Date.now() + ttl });
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
      const { data: roleRows } = await admin
        .from("user_roles").select("roles!inner(name)").eq("user_id", user.id);
      const names = (roleRows ?? []).map((r: any) => r.roles?.name);
      if (!names.includes("Admin") && !names.includes("Super Admin")) {
        return json({ error: "Forbidden" }, 403);
      }
    }

    const body = (await req.json().catch(() => ({}))) as Payload;
    const sourceSystem = body.source_system ?? "zoho_eu_1";
    const perPage = Math.min(Math.max(body.per_page ?? 100, 1), 200);
    const startPage = body.page ?? 1;
    const maxPages = Math.min(Math.max(body.max_pages ?? 5, 1), 20);

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

      const url = `${cfg.booksApiBaseUrl}/recurringinvoices?organization_id=${cfg.organizationId}` +
        `&page=${page}&per_page=${perPage}`;
      const res = await fetch(url, { headers: authH });
      if (!res.ok) {
        const t = await res.text();
        return json({ error: `Zoho recurring profiles page ${page}: ${t.substring(0, 400)}` }, 502);
      }
      const data = await res.json();
      const profiles: any[] = data.recurring_invoices ?? [];
      hasMore = data.page_context?.has_more_page === true;

      for (const p of profiles) {
        processed++;
        const recurringId = String(p.recurring_invoice_id ?? "");
        if (!recurringId) { failed++; continue; }

        const lineItems: any[] = p.line_items ?? [];
        const deviceName = lineItems.length > 0
          ? lineItems.map((li) => li.name ?? li.description).filter(Boolean).join(", ").substring(0, 500)
          : (p.entity_name ?? null);

        const payload = {
          source_system: sourceSystem,
          zoho_recurring_invoice_id: recurringId,
          recurrence_name: p.recurrence_name ?? null,
          reference_number: p.reference_number ?? null,
          status: p.status ?? null,
          customer_id: p.customer_id ? String(p.customer_id) : null,
          customer_name: p.customer_name ?? null,
          company_name: p.company_name ?? null,
          email: p.email ?? null,
          salesperson_name: p.salesperson_name ?? null,
          recurrence_frequency: p.recurrence_frequency ?? null,
          repeat_every: p.repeat_every ?? null,
          start_date: p.start_date || null,
          end_date: p.end_date || null,
          next_invoice_date: p.next_invoice_date || null,
          last_sent_date: p.last_sent_date || null,
          total: p.total != null ? Number(p.total) : null,
          sub_total: p.sub_total != null ? Number(p.sub_total) : null,
          currency: p.currency_code ?? null,
          device_name: deviceName,
          line_items: lineItems,
          raw_data: p,
          synced_at: new Date().toISOString(),
        };

        const { data: existing } = await admin
          .from("zoho_recurring_profiles")
          .select("id")
          .eq("source_system", sourceSystem)
          .eq("zoho_recurring_invoice_id", recurringId)
          .maybeSingle();

        if (existing) {
          const { error } = await admin.from("zoho_recurring_profiles").update(payload).eq("id", existing.id);
          if (error) failed++; else updated++;
        } else {
          const { error } = await admin.from("zoho_recurring_profiles").insert(payload);
          if (error) failed++; else imported++;
        }
      }
      page++;
    }

    return json({
      success: true,
      imported,
      updated,
      failed,
      processed,
      last_page: page - 1,
      has_more: hasMore,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
