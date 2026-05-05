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
  return {
    clientId: Deno.env.get(`${c.prefix}_CLIENT_ID`) ?? "",
    clientSecret: Deno.env.get(`${c.prefix}_CLIENT_SECRET`) ?? "",
    refreshToken: Deno.env.get(`${c.prefix}_REFRESH_TOKEN`) ?? "",
    organizationId: Deno.env.get(`${c.prefix}_ORGANIZATION_ID`) ?? "",
    accountsBaseUrl: c.accountsBase,
    booksApiBaseUrl: c.apiBase,
  };
}

async function getAccessToken(cfg: ReturnType<typeof getZohoConfig>) {
  if (!cfg) throw new Error("Zoho config missing");
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
  if (!data.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data)}`);
  return data.access_token as string;
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
    const perPage = Math.min(Math.max(body.per_page ?? 200, 1), 200);
    const maxPages = Math.min(Math.max(body.max_pages ?? 20, 1), 50);
    const fetchDetails = body.fetch_details !== false;

    const cfg = getZohoConfig(sourceSystem);
    if (!cfg) return json({ error: "Invalid source_system" }, 400);
    const token = await getAccessToken(cfg);

    let imported = 0, updated = 0, failed = 0;
    let page = body.page ?? 1;
    let hasMore = true;

    while (hasMore && page <= (body.page ?? 1) + maxPages - 1) {
      const url = `${cfg.booksApiBaseUrl}/invoices?organization_id=${cfg.organizationId}` +
        `&page=${page}&per_page=${perPage}` +
        `&date_after=${dateFrom}` +
        `&filter_by=Status.All`;

      const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
      if (!res.ok) {
        const t = await res.text();
        return json({ error: `Zoho list error page ${page}: ${t.substring(0, 400)}`, hint: "Code 57 = OAuth-Scope fehlt. Refresh-Token braucht ZohoBooks.invoices.READ." }, 502);
      }
      const data = await res.json();
      // Only keep invoices generated from a recurring profile
      const invoices: any[] = (data.invoices ?? []).filter((inv: any) => !!inv.recurring_invoice_id);
      hasMore = data.page_context?.has_more_page === true;

      for (const inv of invoices) {
        try {
          const invId = String(inv.invoice_id);
          let detail = inv;
          if (fetchDetails) {
            const dRes = await fetch(
              `${cfg.booksApiBaseUrl}/invoices/${invId}?organization_id=${cfg.organizationId}`,
              { headers: { Authorization: `Zoho-oauthtoken ${token}` } },
            );
            if (dRes.ok) {
              const dJson = await dRes.json();
              if (dJson.invoice) detail = { ...inv, ...dJson.invoice };
            }
          }

          const lineItems: any[] = detail.line_items ?? [];
          const deviceName = lineItems.length > 0
            ? lineItems.map((li) => li.name ?? li.description).filter(Boolean).join(", ").substring(0, 500)
            : null;

          const billing = detail.billing_address ?? null;
          const city = billing?.city ?? detail.city ?? null;

          const payload = {
            source_system: sourceSystem,
            zoho_invoice_id: invId,
            zoho_recurring_invoice_id: detail.recurring_invoice_id?.toString() ?? null,
            invoice_number: detail.invoice_number ?? null,
            reference_number: detail.reference_number ?? null,
            customer_name: detail.customer_name ?? null,
            customer_id: detail.customer_id?.toString() ?? null,
            device_name: deviceName,
            city,
            billing_address: billing,
            invoice_date: detail.date ?? null,
            due_date: detail.due_date ?? null,
            currency: detail.currency_code ?? null,
            total: Number(detail.total ?? 0),
            balance: Number(detail.balance ?? 0),
            status: detail.status ?? null,
            payment_status: payStatusFromInvoice(detail),
            last_payment_date: detail.last_payment_date ?? null,
            raw_data: detail,
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

      page++;
    }

    return json({ success: true, imported, updated, failed, last_page: page - 1, has_more: hasMore });
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
});
