// PDF-Auftragsimport – Commit: Kunde matchen/anlegen, Auftrag anlegen, Positionen anlegen
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Corrected = {
  order?: Record<string, any>;
  customer?: Record<string, any>;
  financials?: Record<string, any>;
  delivery?: Record<string, any>;
  contract?: Record<string, any>;
  sales?: Record<string, any>;
  items?: Array<{
    position?: number;
    product_name?: string;
    sku?: string;
    quantity?: number;
    unit_price?: number;
    total_price?: number;
    tax_rate?: number;
  }>;
};

type Body = {
  import_id: string;
  corrected: Corrected;
  customer_choice: { mode: "existing"; id: string } | { mode: "new" };
  auto_followups?: {
    delivery_planning?: boolean;
    mediapaket?: boolean;
    nisv?: boolean;
    financing?: boolean;
    deposit_check?: boolean;
  };
};

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body?.import_id || !body?.corrected || !body?.customer_choice) {
      return j({ error: "import_id, corrected und customer_choice sind Pflicht" }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const user = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: udata } = await user.auth.getUser();
    const userId = udata?.user?.id;
    if (!userId) return j({ error: "Nicht authentifiziert" }, 401);

    // Import prüfen (RLS via user-client)
    const { data: imp, error: impErr } = await user
      .from("pdf_order_imports")
      .select("id, status, source_filename, uploaded_by, created_order_id, document_type")
      .eq("id", body.import_id)
      .maybeSingle();
    if (impErr || !imp) return j({ error: "Import nicht gefunden oder kein Zugriff" }, 404);
    if (imp.status === "committed" || imp.created_order_id) {
      return j({ error: "Dieser Import wurde bereits importiert.", order_id: imp.created_order_id }, 400);
    }
    const isOffer = imp.document_type === "offer";

    const c = body.corrected;
    const cust = c.customer ?? {};
    const ord = c.order ?? {};
    const fin = c.financials ?? {};
    const sales = c.sales ?? {};

    // 1) Kunde
    let customerId: string | null = null;
    let createdCustomer = false;
    if (body.customer_choice.mode === "existing") {
      customerId = body.customer_choice.id;
    } else {
      // Neu anlegen
      const billing = {
        address: [cust.street, cust.house_number].filter(Boolean).join(" ") || null,
        zip: cust.postal_code ?? null,
        city: cust.city ?? null,
        country: cust.country ?? null,
      };
      const payload: Record<string, any> = {
        company_name: cust.company_name ?? cust.studio_name ?? null,
        contact_name: cust.contact_person ?? [cust.first_name, cust.last_name].filter(Boolean).join(" ") || null,
        email: cust.email ?? null,
        phone: cust.phone ?? cust.mobile ?? null,
        billing_address: billing,
        shipping_address: billing,
        source_system: "pdf_import",
        external_customer_id: `pdf-${crypto.randomUUID()}`,
      };
      const { data: newCust, error: cErr } = await admin
        .from("customers")
        .insert(payload)
        .select("id")
        .maybeSingle();
      if (cErr || !newCust) return j({ error: "Kunde konnte nicht angelegt werden: " + cErr?.message }, 500);
      customerId = newCust.id;
      createdCustomer = true;
    }

    // 2) Auftragsnummer aus zentralem Nummernkreis
    let orderNumber: string | null = null;
    try {
      const { data: nn } = await admin.rpc("next_document_number" as any, {
        p_code: "order",
        p_case_number: null,
      });
      if (nn && typeof nn === "string") orderNumber = nn;
    } catch { /* fallback below */ }
    if (!orderNumber) {
      orderNumber = `PDF-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
    }

    const orderDateIso = ord.order_date
      ? new Date(`${String(ord.order_date).slice(0, 10)}T00:00:00Z`).toISOString()
      : new Date().toISOString();
    const expectedShipmentIso = ord.delivery_date_planned
      ? new Date(`${String(ord.delivery_date_planned).slice(0, 10)}T00:00:00Z`).toISOString()
      : null;

    const orderPayload: Record<string, any> = {
      customer_id: customerId,
      order_number: orderNumber,
      source_system: "pdf_import",
      order_status: "offen",
      currency: ord.currency ?? "EUR",
      total_amount: typeof fin.gross_amount === "number" ? fin.gross_amount : null,
      order_date: orderDateIso,
      expected_shipment_date: expectedShipmentIso,
      salesperson_name: sales.salesperson ?? null,
      deposit_amount: typeof fin.downpayment === "number" ? fin.downpayment : null,
      raw_data: {
        source: "pdf_import",
        import_id: body.import_id,
        external_order_number: ord.external_order_number ?? null,
        offer_number: ord.offer_number ?? null,
        contract_number: ord.contract_number ?? null,
        payment_method: fin.payment_method ?? null,
        financing_partner: fin.financing_partner ?? null,
      },
    };

    const { data: newOrder, error: oErr } = await admin
      .from("orders")
      .insert(orderPayload)
      .select("id, order_number")
      .maybeSingle();
    if (oErr || !newOrder) return j({ error: "Auftrag konnte nicht angelegt werden: " + oErr?.message }, 500);

    // 3) Positionen
    const items = (c.items ?? []).map((it, idx) => {
      const qty = Number(it.quantity ?? 0) || 0;
      const rate = Number(it.unit_price ?? 0) || 0;
      const amt = typeof it.total_price === "number" ? it.total_price : qty * rate;
      const tax = ((Number(it.tax_rate) || 0) / 100) * amt;
      return {
        order_id: newOrder.id,
        item_name: it.product_name ?? "(unbenannt)",
        sku: it.sku ?? null,
        quantity: qty,
        rate,
        amount: amt,
        tax_amount: tax,
        item_order: it.position ?? idx + 1,
      };
    });
    if (items.length > 0) {
      const { error: iErr } = await admin.from("order_items").insert(items);
      if (iErr) return j({ error: "Positionen konnten nicht angelegt werden: " + iErr.message }, 500);
    }

    // 4) Import als committed markieren
    await admin
      .from("pdf_order_imports")
      .update({
        status: "committed",
        corrected_extraction_json: c as any,
        created_customer_id: customerId,
        created_order_id: newOrder.id,
        imported_at: new Date().toISOString(),
        imported_by: userId,
        auto_followups: body.auto_followups ?? {},
      })
      .eq("id", body.import_id);

    // 5) Audit
    await admin.from("pdf_order_import_logs").insert({
      order_import_id: body.import_id,
      action: "committed",
      user_id: userId,
      metadata_json: {
        order_id: newOrder.id,
        order_number: newOrder.order_number,
        customer_id: customerId,
        created_customer: createdCustomer,
        item_count: items.length,
        auto_followups: body.auto_followups ?? {},
      },
    });

    return j({
      ok: true,
      order_id: newOrder.id,
      order_number: newOrder.order_number,
      customer_id: customerId,
      created_customer: createdCustomer,
    });
  } catch (e: any) {
    return j({ error: e?.message ?? "Unbekannter Fehler" }, 500);
  }
});
