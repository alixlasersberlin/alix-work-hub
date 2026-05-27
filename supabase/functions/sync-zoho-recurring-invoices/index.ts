import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  source_system?: "zoho_eu_1" | "zoho_eu_2" | "zoho_us_1";
  date_from?: string; // YYYY-MM-DD, default 2025-01-01
  page?: number;
  per_page?: number;
  fetch_details?: boolean; // if true, fetch each invoice's detail (line_items + address)
  max_pages?: number; // safety cap per call
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
  const getEnv = (key: string) => (Deno.env.get(key) ?? "").trim();
  return {
    clientId: getEnv(`${c.prefix}_CLIENT_ID`) || (source === "zoho_eu_2" ? getEnv("ZOHO_EU_1_CLIENT_ID") : ""),
    clientSecret: getEnv(`${c.prefix}_CLIENT_SECRET`) || (source === "zoho_eu_2" ? getEnv("ZOHO_EU_1_CLIENT_SECRET") : ""),
    refreshToken: getEnv(`${c.prefix}_REFRESH_TOKEN`) || (source === "zoho_eu_2" ? getEnv("ZOHO_EU_1_REFRESH_TOKEN") : ""),
    organizationId: getEnv(`${c.prefix}_ORGANIZATION_ID`),
    accountsBaseUrl: c.accountsBase,
    booksApiBaseUrl: c.apiBase,
  };
}

// Module-level token cache: survives across warm invocations, dramatically
// reducing calls to Zoho's heavily rate-limited /oauth/v2/token endpoint.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const tokenRequestCache = new Map<string, Promise<string>>();

class ZohoRateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds = 90) {
    super(message);
    this.name = "ZohoRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAccessToken(cfg: ReturnType<typeof getZohoConfig>) {
  if (!cfg) throw new Error("Zoho config missing");
  if (!cfg.clientId || !cfg.clientSecret || !cfg.refreshToken || !cfg.organizationId) {
    throw new Error("Zoho config incomplete for selected source system");
  }
  const cacheKey = `${cfg.accountsBaseUrl}|${cfg.clientId}|${cfg.refreshToken}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const inFlight = tokenRequestCache.get(cacheKey);
  if (inFlight) return await inFlight;

  const requestPromise = (async () => {
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
      const errDesc = (data?.error_description ?? "").toString().toLowerCase();
      const isRateLimited = errDesc.includes("too many requests") || errDesc.includes("try again after some time");

      if (data?.access_token) {
        const ttlMs = ((data.expires_in ?? 3600) as number) * 1000;
        tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + ttlMs });
        return data.access_token as string;
      }

      if (data?.error === "invalid_code") {
        throw new Response(JSON.stringify({
          error: "Zoho refresh token invalid or revoked",
          code: "ZOHO_REFRESH_TOKEN_INVALID",
          hint: "Please generate a fresh long-lived refresh token for the same Zoho region and OAuth client, then update the project secret.",
        }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (isRateLimited) {
        if (cached && cached.expiresAt > Date.now() + 5_000) {
          return cached.token;
        }

        if (attempt < 3) {
          await sleep(3_000 * (attempt + 1));
          continue;
        }

        throw new ZohoRateLimitError("Zoho blockiert aktuell Token-Anfragen", 90);
      }

      break;
    }

    if (cached && cached.expiresAt > Date.now() + 5_000) {
      return cached.token;
    }

    throw new Error(`Zoho token error: ${JSON.stringify(data)}`);
  })();

  tokenRequestCache.set(cacheKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    tokenRequestCache.delete(cacheKey);
  }
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Auth: admin only (or scheduled service role)
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
    const dateFrom = body.date_from ?? "2025-01-01";
    const perPage = Math.min(Math.max(body.per_page ?? 50, 1), 100);
    const profilesPage = body.page ?? 1;
    const maxProfilePages = Math.min(Math.max(body.max_pages ?? 1, 1), 5);

    const cfg = getZohoConfig(sourceSystem);
    if (!cfg) return json({ error: "Invalid source_system" }, 400);

    let token: string;
    try {
      token = await getAccessToken(cfg);
    } catch (e) {
      if (e instanceof ZohoRateLimitError) {
        return json({
          success: false,
          retryable: true,
          error: "Zoho API-Limit erreicht",
          message: "Zoho blockiert gerade neue Token-Anfragen. Bitte nach kurzer Wartezeit erneut versuchen.",
          retry_after_seconds: e.retryAfterSeconds,
          imported: 0,
          updated: 0,
          failed: 0,
          profiles_processed: 0,
          last_profile_page: Math.max(0, profilesPage - 1),
          profiles_have_more: true,
        }, 200);
      }

      throw e;
    }

    const authH = { Authorization: `Zoho-oauthtoken ${token}` };

    let imported = 0, updated = 0, failed = 0;
    let profilesProcessed = 0;
    let pPage = profilesPage;
    let profilesHaveMore = true;
    const startedAt = Date.now();
    const SOFT_DEADLINE_MS = 60_000; // be conservative to avoid worker resource limits

    while (profilesHaveMore && pPage <= profilesPage + maxProfilePages - 1) {
      if (Date.now() - startedAt > SOFT_DEADLINE_MS) break;

      const profUrl = `${cfg.booksApiBaseUrl}/recurringinvoices?organization_id=${cfg.organizationId}` +
        `&page=${pPage}&per_page=${perPage}`;
      const pRes = await fetch(profUrl, { headers: authH });
      if (!pRes.ok) {
        const t = await pRes.text();
        return json({ error: `Zoho recurring profiles error page ${pPage}: ${t.substring(0, 400)}` }, 502);
      }
      const pData = await pRes.json();
      const profiles: any[] = pData.recurring_invoices ?? [];
      profilesHaveMore = pData.page_context?.has_more_page === true;

      for (const profile of profiles) {
        if (Date.now() - startedAt > SOFT_DEADLINE_MS) { profilesHaveMore = true; break; }
        profilesProcessed++;
        const recurringId = String(profile.recurring_invoice_id);

        // Derive device_name from profile (single source of truth, no per-invoice detail call)
        const profLineItems: any[] = profile.line_items ?? [];
        const profileDeviceName = profLineItems.length > 0
          ? profLineItems.map((li) => li.name ?? li.description).filter(Boolean).join(", ").substring(0, 500)
          : (profile.entity_name ?? null);

        // List invoices generated from this recurring profile
        let iPage = 1;
        let iHasMore = true;
        while (iHasMore) {
          if (Date.now() - startedAt > SOFT_DEADLINE_MS) { profilesHaveMore = true; break; }
          const invUrl = `${cfg.booksApiBaseUrl}/invoices?organization_id=${cfg.organizationId}` +
            `&page=${iPage}&per_page=${perPage}` +
            `&date_after=${dateFrom}` +
            `&filter_by=Status.All` +
            `&recurring_invoice_id=${recurringId}`;
          const iRes = await fetch(invUrl, { headers: authH });
          if (!iRes.ok) { await iRes.text(); break; }
          const iData = await iRes.json();
          const invoices: any[] = iData.invoices ?? [];
          iHasMore = iData.page_context?.has_more_page === true;

          for (const inv of invoices) {
            try {
              const invId = String(inv.invoice_id);
              const billing = inv.billing_address ?? null;
              const city = billing?.city ?? inv.billing_city ?? null;

              const payload = {
                source_system: sourceSystem,
                zoho_invoice_id: invId,
                zoho_recurring_invoice_id: recurringId,
                invoice_number: inv.invoice_number ?? null,
                reference_number: inv.reference_number ?? null,
                customer_name: inv.customer_name ?? profile.customer_name ?? null,
                customer_id: (inv.customer_id ?? profile.customer_id)?.toString() ?? null,
                device_name: profileDeviceName,
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

              const { data: existing } = await admin
                .from("zoho_recurring_invoices")
                .select("id")
                .eq("source_system", sourceSystem)
                .eq("zoho_invoice_id", invId)
                .maybeSingle();

              if (existing) {
                const { error } = await admin.from("zoho_recurring_invoices").update(payload).eq("id", existing.id);
                if (error) throw error;
                updated++;
              } else {
                const { error } = await admin.from("zoho_recurring_invoices").insert(payload);
                if (error) throw error;
                imported++;
              }
            } catch (e: any) {
              console.error("Recurring invoice sync failed:", e?.message);
              failed++;
            }
          }
          iPage++;
        }
      }

      pPage++;
    }

    return json({
      success: true,
      imported,
      updated,
      failed,
      profiles_processed: profilesProcessed,
      last_profile_page: pPage - 1,
      profiles_have_more: profilesHaveMore,
      hint: profilesHaveMore ? "Mehr Profile vorhanden — erneut mit page=" + pPage + " starten." : undefined,
    });

    return json({ success: true, imported, updated, failed, last_page: page - 1, has_more: hasMore });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error(e);
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
});
