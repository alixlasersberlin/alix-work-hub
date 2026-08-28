// Public edge function: Kunde bestätigt den vorgeschlagenen Liefertermin
// oder bittet um einen Alternativtermin. Verifiziert wie der Portal-Lookup
// über Auftragsnummer + PLZ + E-Mail. Kein Auth erforderlich.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  order_number: z.string().trim().min(1).max(64),
  zip: z.string().trim().min(2).max(16),
  email: z.string().trim().email().max(255),
  response: z.enum(["confirmed", "change_requested"]),
  note: z.string().trim().max(500).optional(),
  alternative_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const normZip = (v: unknown) => String(v ?? "").replace(/\s+/g, "").trim();
const normEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();
const normOrderNumber = (v: unknown) => String(v ?? "").trim().replace(/-AT$/i, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ ok: false, error: "invalid_input" }, 400);

    const orderNumber = normOrderNumber(parsed.data.order_number);
    const zip = normZip(parsed.data.zip);
    const email = normEmail(parsed.data.email);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    try {
      const { data: limited } = await supabase.rpc("check_rate_limit", {
        _bucket: `portal-delivery-confirm:${ip || email}`,
        _max: 10,
        _window_seconds: 300,
      });
      if (limited === true) return json({ ok: false, error: "rate_limited" }, 429);
    } catch { /* never block on limiter errors */ }

    const { data: order } = await supabase
      .from("orders")
      .select("id, order_number, billing_address, shipping_address, customer_id")
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (!order) return json({ ok: false, error: "not_found" });

    const { data: customer } = await supabase
      .from("customers")
      .select("email, company_name, contact_name")
      .eq("id", (order as any).customer_id)
      .maybeSingle();

    const zipOk = zip === normZip((order as any).billing_address?.zip) || zip === normZip((order as any).shipping_address?.zip);
    const emailOk = email === normEmail((customer as any)?.email);
    if (!zipOk || !emailOk) return json({ ok: false, error: "not_found" });

    const confirmed = parsed.data.response === "confirmed";
    const { error: upErr } = await supabase.from("order_delivery_status").upsert({
      order_id: (order as any).id,
      customer_response: parsed.data.response,
      customer_responded_at: new Date().toISOString(),
      customer_response_note: parsed.data.note ?? null,
      customer_alternative_date: confirmed ? null : (parsed.data.alternative_date ?? null),
      ...(confirmed ? { eta_confirmed: true } : {}),
    }, { onConflict: "order_id" });
    if (upErr) return json({ ok: false, error: "save_failed" }, 500);

    const name = (customer as any)?.contact_name || (customer as any)?.company_name || "Kunde";
    await supabase.from("order_delivery_events").insert({
      order_id: (order as any).id,
      event_type: "customer_response",
      title: confirmed ? "Liefertermin vom Kunden bestätigt" : "Kunde wünscht einen Alternativtermin",
      description: confirmed
        ? `${name} hat den vorgeschlagenen Liefertermin bestätigt.`
        : `${name} bittet um einen anderen Termin${parsed.data.alternative_date ? ` (Wunsch: ${parsed.data.alternative_date})` : ""}.${parsed.data.note ? ` Hinweis: ${parsed.data.note}` : ""}`,
      visible_to_customer: true,
    }).then(() => {}, () => {});

    // Interne Benachrichtigung an Disposition/Admins
    try {
      const title = confirmed
        ? `Liefertermin bestätigt: ${(order as any).order_number}`
        : `Terminwunsch Kunde: ${(order as any).order_number}`;
      const message = confirmed
        ? `${name} hat den Liefertermin für ${(order as any).order_number} bestätigt.`
        : `${name} wünscht einen anderen Liefertermin für ${(order as any).order_number}${parsed.data.alternative_date ? ` (Wunsch: ${parsed.data.alternative_date})` : ""}.${parsed.data.note ? ` Hinweis: ${parsed.data.note}` : ""}`;

      const { data: recipients } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["Super Admin", "Admin", "Tourenplanung"]);
      const ids = [...new Set(((recipients ?? []) as any[]).map((r) => r.user_id).filter(Boolean))];
      if (ids.length) {
        await supabase.from("app_notifications").insert(
          ids.map((uid) => ({
            user_id: uid,
            kind: "delivery_customer_response",
            severity: confirmed ? "info" : "warning",
            title,
            message,
            link: "/dispatch/lieferstatus",
          })),
        );
      }

      // Web-Push an dieselben internen Empfänger (best effort)
      if (ids.length) {
        await supabase.functions.invoke("mobile-push-send", {
          body: {
            user_ids: ids,
            title,
            body: message.slice(0, 300),
            url: "/dispatch/lieferstatus",
            tag: "delivery-customer-response",
          },
        }).then(() => {}, () => {});
      }


      if (!confirmed) {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            to: ["k.trinh@alix-operation.de", "jh@alix-operation.de"],
            subject: title,
            html: `<p>${message}</p><p><a href="https://app.alixwork.de/dispatch/lieferstatus">Lieferstatus-Cockpit öffnen</a></p>`,
            category: "delivery_customer_response",
          },
        });
      }
    } catch (e) {
      console.error("[portal-delivery-confirm] notify", e);
    }

    return json({ ok: true, response: parsed.data.response });
  } catch (e) {
    console.error("[portal-delivery-confirm]", e);
    return json({ ok: false, error: "server_error" }, 500);
  }
});
