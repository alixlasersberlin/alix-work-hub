import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  source_system?: "zoho_eu_1" | "zoho_eu_2" | "zoho_us_1";
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
  max_pages?: number;
  exclude_profile_name?: string;
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

const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const tokenRequestCache = new Map<string, Promise<string>>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class ZohoRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(msg: string, retry = 90) { super(msg); this.retryAfterSeconds = retry; }
}

async function getAccessToken(cfg: ReturnType<typeof getZohoConfig>) {
  if (!cfg) throw new Error("Zoho config missing");
  const cacheKey = `${cfg.accountsBaseUrl}|${cfg.clientId}|${cfg.refreshToken}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const inFlight = tokenRequestCache.get(cacheKey);
  if (inFlight) return await inFlight;

  const p = (async () => {
    let data: any = null;
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
      data = await res.json();
      if (data?.access_token) {
        tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + ((data.expires_in ?? 3600) * 1000) });
        return data.access_token as string;
      }
      const errDesc = (data?.error_description ?? "").toString().toLowerCase();
      if (errDesc.includes("too many requests")) {
        if (cached && cached.expiresAt > Date.now() + 5_000) return cached.token;
        if (attempt < 3) { await sleep(3000 * (attempt + 1)); continue; }
        throw new ZohoRateLimitError("Zoho Token-Limit", 90);
      }
      break;
    }
    throw new Error(`Zoho token error: ${JSON.stringify(data)}`);
  })();
  tokenRequestCache.set(cacheKey, p);
  try { return await p; } finally { tokenRequestCache.delete(cacheKey); }
}

function payStatusFromInvoice(inv: any): string {
  const s = (inv.status ?? "").toLowerCase();
  if (s === "paid") return "Bezahlt";
  if (s === "partially_paid") return "Teilweise bezahlt";
  if (s === "overdue") return "Überfällig";
  if (s === "sent" || s === "viewed") return "Offen";
  if (s === "draft") return "Entwurf";
  if (s === "void") return "Storniert";
  return inv.status ?? "Unbekannt";
}

// Module-level cache for excluded recurring IDs per source
const excludedRecurringCache = new Map<string, { ids: Set<string>; cachedAt: number }>();
async function getExcludedRecurringIds(cfg: any, token: string, sourceSystem: string, profileName: string): Promise<Set<string>> {
  const cacheKey = `${sourceSystem}|${profileName.toLowerCase()}`;
  const cached = excludedRecurringCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < 10 * 60_000) return cached.ids;

  const ids = new Set<string>();
  const target = profileName.trim().toLowerCase();
  let page = 1;
  let hasMore = true;
  const authH = { Authorization: `Zoho-oauthtoken ${token}` };
  while (hasMore && page < 20) {
    const url = `${cfg.booksApiBaseUrl}/recurringinvoices?organization_id=${cfg.organizationId}&page=${page}&per_page=200`;
    const r = await fetch(url, { headers: authH });
    if (!r.ok) break;
    const d = await r.json();
    const list: any[] = d.recurring_invoices ?? [];
    for (const p of list) {
      const name = (p.profile_name ?? p.recurring_invoice_name ?? p.name ?? "").toString().trim().toLowerCase();
      if (name === target || name.includes(target)) {
        ids.add(String(p.recurring_invoice_id));
      }
    }
    hasMore = d.page_context?.has_more_page === true;
    page++;
  }
  excludedRecurringCache.set(cacheKey, { ids, cachedAt: Date.now() });
  return ids;
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
    const dateFrom = body.date_from ?? "2025-01-01";
    const dateTo = body.date_to;
    const perPage = Math.min(Math.max(body.per_page ?? 100, 1), 200);
    const startPage = body.page ?? 1;
    const maxPages = Math.min(Math.max(body.max_pages ?? 1, 1), 5);
    const excludeProfileName = body.exclude_profile_name ?? "SEPA Ratenzahler";

    const cfg = getZohoConfig(sourceSystem);
    if (!cfg) return json({ error: "Invalid source_system" }, 400);

    let token: string;
    try { token = await getAccessToken(cfg); }
    catch (e) {
      if (e instanceof ZohoRateLimitError) {
        return json({ success: false, retryable: true, error: "Zoho API-Limit erreicht",
          retry_after_seconds: e.retryAfterSeconds, imported: 0, updated: 0, failed: 0,
          skipped_sepa: 0, skipped_recurring: 0, last_page: Math.max(0, startPage - 1), has_more: true });
      }
      throw e;
    }

    const authH = { Authorization: `Zoho-oauthtoken ${token}` };
    const excludedIds = await getExcludedRecurringIds(cfg, token, sourceSystem, excludeProfileName);

    let imported = 0, updated = 0, failed = 0, skippedSepa = 0, skippedRecurring = 0, processed = 0;
    let page = startPage;
    let hasMore = true;
    const startedAt = Date.now();
    const SOFT_DEADLINE_MS = 60_000;

    while (hasMore && page <= startPage + maxPages - 1) {
      if (Date.now() - startedAt > SOFT_DEADLINE_MS) break;
      const url = `${cfg.booksApiBaseUrl}/invoices?organization_id=${cfg.organizationId}` +
        `&page=${page}&per_page=${perPage}&date_after=${dateFrom}` +
        (dateTo ? `&date_before=${dateTo}` : "") +
        `&filter_by=Status.All&sort_column=date&sort_order=A`;
      const r = await fetch(url, { headers: authH });
      if (!r.ok) {
        const t = await r.text();
        return json({ error: `Zoho invoices error page ${page}: ${t.substring(0, 400)}` }, 502);
      }
      const d = await r.json();
      const invoices: any[] = d.invoices ?? [];
      hasMore = d.page_context?.has_more_page === true;

      for (const inv of invoices) {
        processed++;
        const recurringId = inv.recurring_invoice_id ? String(inv.recurring_invoice_id) : null;
        // Exclude all periodic (recurring-generated) invoices
        if (recurringId) {
          if (excludedIds.has(recurringId)) skippedSepa++;
          else skippedRecurring++;
          continue;
        }

        try {
          const invId = String(inv.invoice_id);
          const billing = inv.billing_address ?? null;
          const city = billing?.city ?? inv.billing_city ?? null;
          const payload = {
            source_system: sourceSystem,
            zoho_invoice_id: invId,
            invoice_number: inv.invoice_number ?? null,
            reference_number: inv.reference_number ?? null,
            customer_name: inv.customer_name ?? null,
            customer_id: inv.customer_id?.toString() ?? null,
            city,
            billing_address: billing,
            invoice_date: inv.date ?? null,
            due_date: inv.due_date ?? null,
            currency: inv.currency_code ?? null,
            total: Number(inv.total ?? 0),
            balance: Number(inv.balance ?? 0),
            status: inv.status ?? null,
            payment_status: payStatusFromInvoice(inv),
            last_payment_date: inv.last_payment_date ?? null,
            raw_data: inv,
            synced_at: new Date().toISOString(),
          };

          const { data: existing } = await admin.from("zoho_invoices").select("id")
            .eq("source_system", sourceSystem).eq("zoho_invoice_id", invId).maybeSingle();
          if (existing) {
            const { error } = await admin.from("zoho_invoices").update(payload).eq("id", existing.id);
            if (error) throw error;
            updated++;
          } else {
            const { error } = await admin.from("zoho_invoices").insert(payload);
            if (error) throw error;
            imported++;
          }
        } catch (e: any) {
          console.error("Invoice sync failed:", e?.message);
          failed++;
        }
      }
      page++;
    }

    return json({
      success: true, imported, updated, failed,
      skipped_sepa: skippedSepa, skipped_recurring: skippedRecurring,
      processed, excluded_profile_count: excludedIds.size,
      last_page: page - 1, has_more: hasMore,
      hint: hasMore ? `Mehr Rechnungen vorhanden — erneut mit page=${page}` : undefined,
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error(e);
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
});
