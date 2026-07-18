// Processes rows from public.orders_inbox with status='received':
// creates/updates public.orders and public.order_items, then marks inbox row processed.
// Idempotent: skips if an order with (source_system, order_number) already exists.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveCustomerId(
  supabase: ReturnType<typeof createClient>,
  payload: any,
  sourceSystem: string,
): Promise<string | null> {
  const c = payload?.customer ?? {};
  // 1) direct alixwork_id -> customers.id
  if (c.alixwork_id) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("id", c.alixwork_id)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  // 2) external_customer_id + source_system
  if (c.external_id) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("source_system", sourceSystem)
      .eq("external_customer_id", c.external_id)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  // 3) email match (any source)
  if (c.email) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("email", c.email)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  // 4) create minimal customer
  const { data: created, error } = await supabase
    .from("customers")
    .insert({
      source_system: sourceSystem,
      external_customer_id: c.external_id ?? c.alixwork_id ?? null,
      company_name: c.company_name ?? payload?.billing_address?.company ?? null,
      contact_name: c.contact_name ?? payload?.billing_address?.name ?? null,
      email: c.email ?? null,
      phone: c.mobile ?? payload?.billing_address?.phone ?? null,
      billing_address: payload?.billing_address ?? null,
      shipping_address: payload?.shipping_address ?? null,
      raw_data: c,
    })
    .select("id")
    .single();
  if (error) {
    console.error("customer create failed", error);
    return null;
  }
  return created.id;
}

async function processOne(
  supabase: ReturnType<typeof createClient>,
  row: any,
): Promise<{ ok: boolean; order_id?: string; skipped?: boolean; error?: string }> {
  const payload = row.payload ?? {};
  const sourceSystem = row.source_system || payload.source || "alixsmart";
  const orderNumber =
    row.external_id || payload.order_number || payload.order_id;
  if (!orderNumber) return { ok: false, error: "missing_order_number" };

  // Dedup on (source_system, order_number)
  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("source_system", sourceSystem)
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (existing?.id) {
    return { ok: true, order_id: existing.id, skipped: true };
  }

  const customerId = await resolveCustomerId(supabase, payload, sourceSystem);
  if (!customerId) return { ok: false, error: "customer_resolution_failed" };

  const totalAmount =
    payload.total_gross ?? payload.total ?? payload.total_amount ?? null;
  const orderDate =
    payload.submitted_at ?? payload.created_at ?? new Date().toISOString();

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      customer_id: customerId,
      external_order_id: payload.source_order_id ?? payload.external_id ?? null,
      order_number: orderNumber,
      source_system: sourceSystem,
      order_status: "offen",
      currency: payload.currency ?? "EUR",
      total_amount: totalAmount,
      order_date: orderDate,
      billing_address: payload.billing_address ?? null,
      shipping_address: payload.shipping_address ?? null,
      raw_data: payload,
    })
    .select("id")
    .single();
  if (orderErr) {
    console.error("order insert failed", orderErr);
    return { ok: false, error: `order_insert: ${orderErr.message}` };
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length > 0) {
    const rows = items.map((it: any, idx: number) => {
      const qty = Number(it.quantity ?? 1);
      const rate = Number(it.unit_price_net ?? it.rate ?? it.unit_price ?? 0);
      const amount = Number(
        it.line_total_gross ?? it.amount ?? rate * qty ?? 0,
      );
      return {
        order_id: order.id,
        external_item_id: it.product_id ?? null,
        item_name: it.name ?? null,
        sku: it.sku ?? null,
        quantity: qty,
        rate,
        amount,
        tax_amount:
          it.tax_amount != null
            ? Number(it.tax_amount)
            : it.tax_rate != null
              ? Number((rate * qty * (Number(it.tax_rate) / 100)).toFixed(2))
              : 0,
        item_order: idx,
        raw_data: it,
      };
    });
    const { error: itemsErr } = await supabase.from("order_items").insert(rows);
    if (itemsErr) {
      console.error("order_items insert failed", itemsErr);
      // Do not fail the whole process; log on inbox row
      return { ok: true, order_id: order.id, error: `items: ${itemsErr.message}` };
    }
  }

  return { ok: true, order_id: order.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let limit = 50;
  let onlyId: string | null = null;
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (typeof body?.limit === "number") limit = Math.min(200, body.limit);
    if (typeof body?.id === "string") onlyId = body.id;
  } catch { /* ignore */ }

  let query = supabase
    .from("orders_inbox")
    .select("id, source_system, external_id, payload, status")
    .eq("status", "received")
    .order("received_at", { ascending: true })
    .limit(limit);
  if (onlyId) query = supabase.from("orders_inbox").select("id, source_system, external_id, payload, status").eq("id", onlyId);

  const { data: rows, error } = await query;
  if (error) return json(500, { error: error.message });

  const results: any[] = [];
  for (const row of rows ?? []) {
    const res = await processOne(supabase, row);
    const status = res.ok ? "processed" : "error";
    const errText = res.error ?? null;
    await supabase
      .from("orders_inbox")
      .update({
        status,
        error: errText,
        processed_at: res.ok ? new Date().toISOString() : null,
      })
      .eq("id", row.id);
    results.push({ id: row.id, ...res });
  }

  return json(200, { processed: results.length, results });
});
