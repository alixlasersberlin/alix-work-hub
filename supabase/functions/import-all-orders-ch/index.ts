// One-off: imports ALL Alix Lasers Schweiz sales orders from Zoho EU 1
// (branch_id = 598077000000065075). Reuses ZOHO_EU_1_* credentials.
// Stays on source_system='zoho_eu_1' — CH is distinguished via raw_data.branch_id.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CH_BRANCH_ID = "598077000000065075";
const SOURCE = "zoho_eu_1";
const ACCOUNTS = "https://accounts.zoho.eu";
const API = "https://www.zohoapis.eu/books/v3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORG_ID = Deno.env.get("ZOHO_EU_1_ORGANIZATION_ID") ?? "";
const CLIENT_ID = Deno.env.get("ZOHO_EU_1_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("ZOHO_EU_1_CLIENT_SECRET") ?? "";
const REFRESH_TOKEN = Deno.env.get("ZOHO_EU_1_REFRESH_TOKEN") ?? "";

async function getAccessToken(): Promise<string> {
  const res = await fetch(`${ACCOUNTS}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error(`Token error: ${JSON.stringify(j)}`);
  return j.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (!token || (token !== cronSecret && token !== SERVICE_KEY)) {
    // Allow logged-in users (token will be a JWT verified by Supabase elsewhere)
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const t0 = Date.now();
  const HARD_LIMIT_MS = 250_000;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let accessToken: string;
  try { accessToken = await getAccessToken(); } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "token failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  async function ensureCustomer(externalCustomerId: string): Promise<string | null> {
    const { data: ex } = await admin.from("customers").select("id")
      .eq("external_customer_id", externalCustomerId).eq("source_system", SOURCE).maybeSingle();
    if (ex) return ex.id;
    try {
      const r = await fetch(`${API}/contacts/${externalCustomerId}?organization_id=${ORG_ID}`,
        { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
      if (!r.ok) return null;
      const c = (await r.json()).contact;
      if (!c) return null;
      const { data: ins } = await admin.from("customers").upsert({
        external_customer_id: String(c.contact_id),
        source_system: SOURCE,
        company_name: c.company_name ?? null,
        contact_name: c.contact_name ?? null,
        email: c.email ?? null,
        phone: c.mobile || c.phone || null,
        billing_address: c.billing_address ?? null,
        shipping_address: c.shipping_address ?? null,
        raw_data: c,
      }, { onConflict: "external_customer_id,source_system" }).select("id").single();
      return ins?.id ?? null;
    } catch { return null; }
  }

  async function syncLineItems(orderId: string, lineItems: any[]) {
    if (!Array.isArray(lineItems)) return;
    for (let i = 0; i < lineItems.length; i++) {
      const li = lineItems[i];
      const externalItemId = li.line_item_id?.toString() || li.item_id?.toString() || null;
      const payload: any = {
        order_id: orderId,
        external_item_id: externalItemId,
        item_name: li.name ?? li.item_name ?? null,
        description: li.description ?? null,
        sku: li.sku ?? li.item_code ?? null,
        quantity: li.quantity ?? 1,
        rate: li.rate ?? null,
        amount: li.item_total ?? li.amount ?? null,
        discount: li.discount_amount ?? li.discount ?? 0,
        tax_amount: li.tax_amount ?? 0,
        unit: li.unit ?? null,
        item_order: li.item_order ?? i,
        raw_data: li,
      };
      if (externalItemId) {
        const { data: ex } = await admin.from("order_items").select("id")
          .eq("order_id", orderId).eq("external_item_id", externalItemId).maybeSingle();
        if (ex) await admin.from("order_items").update(payload).eq("id", ex.id);
        else await admin.from("order_items").insert(payload);
      } else {
        await admin.from("order_items").insert(payload);
      }
    }
  }

  let page = 1;
  const MAX_PAGES = 50;
  let imported = 0, updated = 0, skipped = 0, failed = 0, fetched = 0;
  const errors: any[] = [];

  while (page <= MAX_PAGES) {
    if (Date.now() - t0 > HARD_LIMIT_MS) break;
    const url = `${API}/salesorders?organization_id=${ORG_ID}&branch_id=${CH_BRANCH_ID}&page=${page}&per_page=200`;
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!res.ok) {
      const txt = await res.text();
      errors.push({ page, zoho_error: txt.slice(0, 500) });
      break;
    }
    const json = await res.json();
    const list = json.salesorders ?? [];
    const hasMore = json.page_context?.has_more_page === true;
    if (list.length === 0) break;
    fetched += list.length;

    for (const so of list) {
      const externalOrderId = so.salesorder_id?.toString();
      const externalCustomerId = so.customer_id?.toString();
      if (!externalOrderId || !externalCustomerId) { skipped++; continue; }
      try {
        const customerId = await ensureCustomer(externalCustomerId);
        if (!customerId) { skipped++; errors.push({ id: externalOrderId, message: "customer missing" }); continue; }

        let detail = so;
        try {
          const dRes = await fetch(`${API}/salesorders/${externalOrderId}?organization_id=${ORG_ID}`,
            { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
          if (dRes.ok) {
            const dJson = await dRes.json();
            if (dJson.salesorder) detail = dJson.salesorder;
          }
        } catch { /* ignore */ }

        const nullIfEmpty = (v: any) => (v == null || v === "" ? null : v);
        const orderPayload: any = {
          external_order_id: externalOrderId,
          source_system: SOURCE,
          customer_id: customerId,
          order_number: detail.salesorder_number ?? so.salesorder_number ?? externalOrderId,
          order_date: nullIfEmpty(detail.date ?? so.date),
          expected_shipment_date: nullIfEmpty(detail.shipment_date ?? so.shipment_date),
          order_status: detail.status ?? so.status ?? "offen",
          total_amount: detail.total ?? so.total ?? null,
          currency: detail.currency_code ?? so.currency_code ?? null,
          salesperson_name: detail.salesperson_name ?? so.salesperson_name ?? null,
          shipping_address: detail.shipping_address ?? null,
          billing_address: detail.billing_address ?? null,
          raw_data: detail,
        };

        const { data: ex } = await admin.from("orders")
          .select("id, raw_data")
          .eq("external_order_id", externalOrderId)
          .eq("source_system", SOURCE).maybeSingle();

        let orderId: string | null = null;
        if (ex) {
          const { error: e } = await admin.from("orders").update(orderPayload).eq("id", ex.id);
          if (e) { failed++; errors.push({ id: externalOrderId, message: e.message }); continue; }
          orderId = ex.id; updated++;
        } else {
          const { data: ins, error: e } = await admin.from("orders").insert(orderPayload).select("id").single();
          if (e || !ins) { failed++; errors.push({ id: externalOrderId, message: e?.message ?? "insert failed" }); continue; }
          orderId = ins.id; imported++;
        }

        if (orderId && Array.isArray(detail.line_items)) {
          await syncLineItems(orderId, detail.line_items);
        }
      } catch (err: any) {
        failed++;
        errors.push({ id: externalOrderId, message: err?.message ?? "unknown" });
      }
    }

    if (!hasMore) break;
    page++;
  }

  return new Response(JSON.stringify({
    success: true,
    branch_id: CH_BRANCH_ID,
    source_system: SOURCE,
    totals: { fetched, imported, updated, skipped, failed },
    duration_ms: Date.now() - t0,
    errors: errors.slice(0, 20),
  }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
});
