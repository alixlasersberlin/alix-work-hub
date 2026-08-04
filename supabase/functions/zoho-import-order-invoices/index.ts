// Import a single Zoho sales order together with all invoices belonging to it.
// Auth: service key, CRON_SECRET or authenticated Admin / order manager.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type SourceSystem = "zoho_eu_1" | "zoho_eu_2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getZohoConfig(source: SourceSystem) {
  const orgPrefix = source === "zoho_eu_2" ? "ZOHO_EU_2" : "ZOHO_EU_1";
  const env = (k: string) => (Deno.env.get(k) ?? "").trim();
  return {
    clientId: env("ZOHO_EU_1_CLIENT_ID"),
    clientSecret: env("ZOHO_EU_1_CLIENT_SECRET"),
    refreshToken: env("ZOHO_EU_1_REFRESH_TOKEN"),
    organizationId: env(`${orgPrefix}_ORGANIZATION_ID`),
    accountsBaseUrl: "https://accounts.zoho.eu",
    booksApiBaseUrl: "https://www.zohoapis.eu/books/v3",
  };
}

async function getAccessToken(cfg: ReturnType<typeof getZohoConfig>) {
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
  if (!data?.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data).slice(0, 300)}`);
  return data.access_token as string;
}

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
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    let authed = !!bearer && (bearer === SERVICE_KEY || (!!cronSecret && bearer === cronSecret));
    if (!authed && bearer) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: u } = await userClient.auth.getUser(bearer);
      if (u?.user) {
        const { data: isAdmin } = await userClient.rpc("is_admin");
        authed = !!isAdmin;
        if (!authed) {
          const { data: canManage } = await userClient.rpc("can_manage_orders");
          authed = !!canManage;
        }
      }
    }
    if (!authed) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const source: SourceSystem = body?.source_system === "zoho_eu_2" ? "zoho_eu_2" : "zoho_eu_1";
    const query = String(body?.order_number ?? body?.query ?? "").trim();
    const salesorderIdInput = body?.salesorder_id ? String(body.salesorder_id).trim() : "";
    const importOrder = body?.import_order !== false;
    const importInvoices = body?.import_invoices !== false;

    if (!query && !salesorderIdInput) {
      return json({ error: "order_number oder salesorder_id erforderlich" }, 400);
    }

    const cfg = getZohoConfig(source);
    if (!cfg.clientId || !cfg.refreshToken || !cfg.organizationId) {
      return json({ error: "Zoho-Zugangsdaten fehlen", message: `Konfiguration für ${source} unvollständig.` }, 500);
    }
    const token = await getAccessToken(cfg);
    const authH = { Authorization: `Zoho-oauthtoken ${token}` };
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Resolve sales order
    let salesorderId = salesorderIdInput;
    let salesorderNumber = query;
    if (!salesorderId) {
      const lookupUrl = `${cfg.booksApiBaseUrl}/salesorders?organization_id=${cfg.organizationId}` +
        `&salesorder_number_contains=${encodeURIComponent(query)}&per_page=10`;
      const r = await fetch(lookupUrl, { headers: authH });
      if (!r.ok) return json({ error: "Zoho-Suche fehlgeschlagen", message: (await r.text()).slice(0, 400) }, 502);
      const j = await r.json();
      const rows: any[] = Array.isArray(j.salesorders) ? j.salesorders : [];
      const exact = rows.find((x) => String(x.salesorder_number ?? "").toUpperCase() === query.toUpperCase());
      const hit = exact ?? rows[0];
      if (!hit) {
        return json({
          error: "Auftrag nicht gefunden",
          message: `Kein Auftrag "${query}" in ${source} gefunden.`,
        }, 404);
      }
      salesorderId = String(hit.salesorder_id);
      salesorderNumber = String(hit.salesorder_number ?? query);
    }

    // 2) Sales order detail (contains linked invoices)
    const detRes = await fetch(
      `${cfg.booksApiBaseUrl}/salesorders/${salesorderId}?organization_id=${cfg.organizationId}`,
      { headers: authH },
    );
    if (!detRes.ok) return json({ error: "Zoho Auftragsdetails fehlgeschlagen", message: (await detRes.text()).slice(0, 400) }, 502);
    const detJson = await detRes.json();
    const so = detJson.salesorder ?? {};
    salesorderNumber = String(so.salesorder_number ?? salesorderNumber);
    const customerId = so.customer_id ? String(so.customer_id) : null;

    // 3) Import order itself
    const result: any = {
      ok: true,
      source_system: source,
      salesorder_id: salesorderId,
      salesorder_number: salesorderNumber,
      customer_name: so.customer_name ?? null,
      order_imported: false,
      order_error: null as string | null,
      invoices_found: 0,
      invoices_imported: 0,
      invoices_updated: 0,
      invoices_failed: 0,
      invoices: [] as any[],
    };

    if (importOrder) {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/sync-single-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        body: JSON.stringify({ source_system: source, external_order_id: salesorderId }),
      });
      const rb = await r.json().catch(() => ({}));
      if (r.ok) result.order_imported = true;
      else result.order_error = (rb as any)?.message || (rb as any)?.error || `HTTP ${r.status}`;
    }

    // 4) Collect invoice ids: from salesorder detail + fallback via reference number / customer
    const invoiceIds = new Set<string>();
    for (const inv of (Array.isArray(so.invoices) ? so.invoices : [])) {
      if (inv?.invoice_id) invoiceIds.add(String(inv.invoice_id));
    }
    if (importInvoices && customerId) {
      const listRes = await fetch(
        `${cfg.booksApiBaseUrl}/invoices?organization_id=${cfg.organizationId}&customer_id=${customerId}&per_page=200&filter_by=Status.All`,
        { headers: authH },
      );
      if (listRes.ok) {
        const lj = await listRes.json();
        for (const inv of (Array.isArray(lj.invoices) ? lj.invoices : [])) {
          const ref = String(inv.reference_number ?? "").toUpperCase();
          if (ref && salesorderNumber && ref.includes(salesorderNumber.toUpperCase())) {
            invoiceIds.add(String(inv.invoice_id));
          }
        }
      }
    }
    result.invoices_found = invoiceIds.size;

    // 5) Import each invoice
    if (importInvoices) {
      for (const invId of invoiceIds) {
        try {
          const ir = await fetch(
            `${cfg.booksApiBaseUrl}/invoices/${invId}?organization_id=${cfg.organizationId}`,
            { headers: authH },
          );
          if (!ir.ok) throw new Error((await ir.text()).slice(0, 200));
          const inv = (await ir.json()).invoice ?? {};
          const region = detectInvoiceRegion(inv);
          const billing = inv.billing_address ?? null;
          const payload = {
            source_system: source,
            zoho_invoice_id: String(inv.invoice_id),
            invoice_number: inv.invoice_number ?? null,
            reference_number: inv.reference_number ?? null,
            customer_name: inv.customer_name ?? null,
            customer_id: inv.customer_id?.toString() ?? null,
            city: billing?.city ?? null,
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
            accounting_region: region,
            synced_at: new Date().toISOString(),
          };
          const { data: upserted, error } = await admin
            .from("zoho_invoices")
            .upsert(payload, { onConflict: "source_system,zoho_invoice_id" })
            .select("id, created_at, updated_at")
            .single();
          if (error) throw error;
          const isNew = upserted?.created_at && upserted?.updated_at &&
            new Date(upserted.updated_at).getTime() - new Date(upserted.created_at).getTime() < 2000;
          if (isNew) result.invoices_imported++; else result.invoices_updated++;
          result.invoices.push({
            invoice_number: payload.invoice_number,
            date: payload.invoice_date,
            total: payload.total,
            balance: payload.balance,
            status: payload.payment_status,
            region,
            state: isNew ? "neu" : "aktualisiert",
          });
        } catch (e) {
          result.invoices_failed++;
          result.invoices.push({ invoice_id: invId, state: "fehler", message: (e as Error).message });
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    return json(result);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? "Unbekannter Fehler" }, 500);
  }
});
