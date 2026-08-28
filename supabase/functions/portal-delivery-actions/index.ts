// Öffentliche Edge Function: Kundenaktionen zur Lieferung im Portal.
// Verifiziert wie der Portal-Lookup über Auftragsnummer + PLZ + E-Mail.
// Aktionen: Adresse bestätigen, Adressänderung melden, Lieferbedingungen,
// Ansprechpartner am Liefertag, Terminänderungswunsch mit Präferenzen.
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
  action: z.enum(["confirm_address", "address_change", "conditions", "contact", "reschedule"]),
  note: z.string().trim().max(1000).optional(),
  address: z.object({
    company: z.string().max(160).optional(),
    street: z.string().max(160).optional(),
    zip: z.string().max(16).optional(),
    city: z.string().max(120).optional(),
    country: z.string().max(80).optional(),
    attention: z.string().max(120).optional(),
    phone: z.string().max(40).optional(),
  }).optional(),
  conditions: z.record(z.union([z.boolean(), z.string().max(200), z.number()])).optional(),
  contact: z.object({
    name: z.string().max(120).optional(),
    phone: z.string().max(40).optional(),
    email: z.string().max(160).optional(),
    role: z.string().max(120).optional(),
  }).optional(),
  reschedule: z.object({
    kind: z.enum(["other_date", "morning", "afternoon", "weekdays", "callback", "other"]),
    weekdays: z.array(z.string().max(12)).max(7).optional(),
    alternative_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).optional(),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const normZip = (v: unknown) => String(v ?? "").replace(/\s+/g, "").trim();
const normEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();
const normOrderNumber = (v: unknown) => String(v ?? "").trim().replace(/-AT$/i, "");

const ACTION_TITLE: Record<string, string> = {
  confirm_address: "Lieferadresse vom Kunden bestätigt",
  address_change: "Kunde meldet eine abweichende Lieferadresse",
  conditions: "Kunde hat Lieferbedingungen übermittelt",
  contact: "Kunde hat einen Ansprechpartner benannt",
  reschedule: "Kunde wünscht eine Terminänderung",
};

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
        _bucket: `portal-delivery-actions:${ip || email}`,
        _max: 20,
        _window_seconds: 300,
      });
      if (limited === true) return json({ ok: false, error: "rate_limited" }, 429);
    } catch { /* Limiter darf nie blockieren */ }

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

    const orderId = (order as any).id as string;
    const name = (customer as any)?.contact_name || (customer as any)?.company_name || "Kunde";
    const action = parsed.data.action;
    const now = new Date().toISOString();

    const patch: Record<string, unknown> = { order_id: orderId };
    let description = parsed.data.note ?? null;

    if (action === "confirm_address") {
      patch.address_confirmed = true;
      patch.address_confirmed_at = now;
      description = "Der Kunde hat die hinterlegte Lieferadresse als korrekt bestätigt.";
    } else if (action === "address_change") {
      patch.address_confirmed = false;
      await supabase.from("order_delivery_address_requests").insert({
        order_id: orderId,
        proposed: parsed.data.address ?? {},
        note: parsed.data.note ?? null,
      });
      description = `Änderungswunsch zur Lieferadresse: ${
        [parsed.data.address?.company, parsed.data.address?.street, parsed.data.address?.zip, parsed.data.address?.city, parsed.data.address?.country]
          .filter(Boolean).join(", ") || "ohne Angabe"
      }${parsed.data.note ? ` – Hinweis: ${parsed.data.note}` : ""}`;
    } else if (action === "conditions") {
      patch.delivery_conditions = parsed.data.conditions ?? {};
      description = "Der Kunde hat Angaben zu den Gegebenheiten vor Ort übermittelt.";
    } else if (action === "contact") {
      patch.onsite_contact = parsed.data.contact ?? {};
      description = `Ansprechpartner am Liefertag: ${parsed.data.contact?.name ?? "–"}${parsed.data.contact?.phone ? `, ${parsed.data.contact.phone}` : ""}`;
    } else if (action === "reschedule") {
      patch.customer_response = "change_requested";
      patch.customer_responded_at = now;
      patch.customer_response_note = parsed.data.note ?? null;
      patch.customer_alternative_date = parsed.data.reschedule?.alternative_date ?? null;
      patch.reschedule_preference = parsed.data.reschedule ?? {};
      patch.eta_confirmed = false;
      description = `Terminänderungswunsch (${parsed.data.reschedule?.kind ?? "unbekannt"})${
        parsed.data.reschedule?.alternative_date ? `, Wunschtermin ${parsed.data.reschedule.alternative_date}` : ""
      }${parsed.data.note ? ` – ${parsed.data.note}` : ""}`;
    }

    const { error: upErr } = await supabase
      .from("order_delivery_status")
      .upsert(patch, { onConflict: "order_id" });
    if (upErr) {
      console.error("[portal-delivery-actions] upsert", upErr);
      return json({ ok: false, error: "save_failed" }, 500);
    }

    // Audit / Historie – niemals überschreiben, immer anhängen
    await supabase.from("order_delivery_events").insert({
      order_id: orderId,
      event_type: `customer_${action}`,
      title: ACTION_TITLE[action],
      description,
      visible_to_customer: action !== "address_change" ? true : false,
    }).then(() => {}, () => {});

    await supabase.from("order_delivery_comms").insert({
      order_id: orderId,
      channel: "portal",
      direction: "inbound",
      event_key: action,
      subject: ACTION_TITLE[action],
      body: description,
      recipient: email,
    }).then(() => {}, () => {});

    // Interne Benachrichtigung
    try {
      const title = `${ACTION_TITLE[action]}: ${(order as any).order_number}`;
      const message = `${name} – ${description ?? ""}`.trim();
      const { data: recipients } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["Super Admin", "Admin", "Tourenplanung"]);
      const ids = [...new Set(((recipients ?? []) as any[]).map((r) => r.user_id).filter(Boolean))];
      if (ids.length) {
        await supabase.from("app_notifications").insert(
          ids.map((uid) => ({
            user_id: uid,
            kind: "delivery_customer_action",
            severity: action === "confirm_address" || action === "contact" ? "info" : "warning",
            title,
            message,
            link: "/dispatch/control-tower",
          })),
        );
      }
      if (action === "address_change" || action === "reschedule") {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            to: ["k.trinh@alix-operation.de", "jh@alix-operation.de"],
            subject: title,
            html: `<p>${message}</p><p><a href="https://app.alixwork.de/dispatch/control-tower">Delivery Control Tower öffnen</a></p>`,
            category: "delivery_customer_action",
          },
        });
      }
    } catch (e) {
      console.error("[portal-delivery-actions] notify", e);
    }

    return json({ ok: true, action });
  } catch (e) {
    console.error("[portal-delivery-actions]", e);
    return json({ ok: false, error: "server_error" }, 500);
  }
});
