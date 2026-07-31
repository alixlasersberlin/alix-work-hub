// Importiert alle Zoho-Rechnungen mit Status "draft" (Entwurf) und legt sie
// direkt als Mietkauf-Rechnungen (is_mietkauf = true) in zoho_invoices ab.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CH_BRANCH_ID = "598077000000065075";
const CH_MARKERS = ["alix lasers ® schweiz", "alix lasers (r) schweiz", "alix lasers schweiz"];

function detectInvoiceRegion(inv: any): "EU" | "CH" {
  if (inv?.branch_id && String(inv.branch_id) === CH_BRANCH_ID) return "CH";
  if ((inv?.currency_code ?? "").toString().toUpperCase() === "CHF") return "CH";
  const hay = JSON.stringify(inv ?? {}).toLowerCase();
  if (CH_MARKERS.some((m) => hay.includes(m))) return "CH";
  const country = (inv?.billing_address?.country ?? inv?.billing_address?.country_code ?? "").toString().toLowerCase();
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

async function getAccessToken(cfg: NonNullable<ReturnType<typeof getZohoConfig>>) {
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
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");
    const draftCronToken = Deno.env.get("ZOHO_DRAFT_CRON_TOKEN");
    const cronTokenHeader = req.headers.get("x-cron-token") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const apiKeyHeader = req.headers.get("apikey") ?? "";

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const isMachine =
      authHeader === `Bearer ${serviceKey}` ||
      apiKeyHeader === serviceKey ||
      (!!cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (!!draftCronToken && cronTokenHeader === draftCronToken);

    if (!isMachine) {
      if (!authHeader) return json({ error: "Missing authorization" }, 401);
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

    const body = (await req.json().catch(() => ({}))) as {
      source_system?: "zoho_eu_1" | "zoho_eu_2";
      date_from?: string;
      mark_mietkauf?: boolean;
    };
    const sourceSystem = body.source_system ?? "zoho_eu_1";
    const dateFrom = body.date_from ?? "2024-01-01";
    const markMietkauf = body.mark_mietkauf !== false;

    const cfg = getZohoConfig(sourceSystem);
    if (!cfg) return json({ error: "Invalid source_system" }, 400);
    const token = await getAccessToken(cfg);
    const authH = { Authorization: `Zoho-oauthtoken ${token}` };

    let imported = 0, updated = 0, failed = 0, processed = 0;
    let page = 1;
    let hasMore = true;
    const startedAt = Date.now();

    while (hasMore && page <= 30 && Date.now() - startedAt < 90_000) {
      const url = `${cfg.booksApiBaseUrl}/invoices?organization_id=${cfg.organizationId}` +
        `&page=${page}&per_page=200&date_after=${dateFrom}&filter_by=Status.Draft&sort_column=date&sort_order=A`;
      const r = await fetch(url, { headers: authH });
      if (!r.ok) {
        const t = await r.text();
        return json({ error: `Zoho draft invoices error page ${page}: ${t.substring(0, 400)}` }, 502);
      }
      const d = await r.json();
      const invoices: any[] = d.invoices ?? [];
      hasMore = d.page_context?.has_more_page === true;

      for (const inv of invoices) {
        processed++;
        try {
          const region = detectInvoiceRegion(inv);
          const billing = inv.billing_address ?? null;
          const payload: Record<string, unknown> = {
            source_system: sourceSystem,
            zoho_invoice_id: String(inv.invoice_id),
            invoice_number: inv.invoice_number ?? null,
            reference_number: inv.reference_number ?? null,
            customer_name: inv.customer_name ?? null,
            customer_id: inv.customer_id?.toString() ?? null,
            city: billing?.city ?? inv.billing_city ?? null,
            billing_address: billing,
            invoice_date: inv.date ?? null,
            due_date: inv.due_date ?? null,
            currency: inv.currency_code ?? null,
            total: Number(inv.total ?? 0),
            balance: Number(inv.balance ?? 0),
            status: inv.status ?? "draft",
            payment_status: "Entwurf",
            raw_data: inv,
            accounting_region: region,
            synced_at: new Date().toISOString(),
          };
          if (markMietkauf) {
            payload.is_mietkauf = true;
            payload.mietkauf_booked_at = new Date().toISOString();
          }

          const { data: up, error } = await admin
            .from("zoho_invoices")
            .upsert(payload, { onConflict: "source_system,zoho_invoice_id" })
            .select("id, created_at, updated_at")
            .single();
          if (error) throw error;
          if (up?.created_at && up?.updated_at &&
              new Date(up.updated_at).getTime() - new Date(up.created_at).getTime() < 2000) imported++;
          else updated++;
        } catch (e: any) {
          console.error("Draft invoice sync failed:", e?.message);
          failed++;
        }
      }
      page++;
    }

    return json({ success: true, source_system: sourceSystem, processed, imported, updated, failed, has_more: hasMore });
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
});
