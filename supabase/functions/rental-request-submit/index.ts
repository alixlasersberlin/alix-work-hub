// Öffentliche Mietanfrage (/miete/premium).
// Nutzt die bestehende Lead-Logik (sales_leads) – kein zweites CRM.
// Preise werden IMMER serverseitig aus dem Product Hub geprüft.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { rentalInfo } from "../rental-devices/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const s = (max: number) => z.string().trim().max(max).optional().nullable().default("");

const Body = z.object({
  product_hub_id: z.string().uuid(),
  requested_term_months: z.number().int().min(1).max(120),
  requested_start: z.string().max(60),
  requested_start_date: s(20),

  customer_type: z.string().max(60),
  company_name: s(160),
  legal_form: s(80),
  company_foundation_date: s(20),
  commercial_register: s(120),
  commercial_register_number: s(60),
  vat_id: s(40),
  tax_number: s(40),
  website: s(200),
  social_media: s(200),
  industry: s(80),

  salutation: s(20),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  birth_date: s(20),
  position: s(80),
  email: z.string().trim().email().max(160),
  mobile: z.string().trim().min(5).max(40),
  phone: s(40),

  street: z.string().trim().min(1).max(120),
  house_number: z.string().trim().min(1).max(20),
  postal_code: z.string().trim().min(3).max(12),
  city: z.string().trim().min(1).max(80),
  country: z.string().trim().min(2).max(60),

  delivery_same: z.boolean().default(true),
  delivery_company: s(160),
  delivery_contact: s(120),
  delivery_street: s(120),
  delivery_house_number: s(20),
  delivery_postal_code: s(12),
  delivery_city: s(80),
  delivery_country: s(60),

  company_since: s(20),
  employees: s(20),
  studio_open: s(10),
  planned_opening_date: s(20),
  existing_devices: s(10),
  existing_devices_text: s(600),
  monthly_budget: s(40),
  startup: z.boolean().default(false),
  location_available: s(10),
  trade_registration_status: s(40),
  rental_start_mode: s(60),
  startup_support: z.boolean().default(false),
  notes: s(2000),

  source_url: s(400),
  campaign: s(120),
  finder_result: s(200),

  consent_correct: z.literal(true),
  consent_data: z.literal(true),
  consent_contact: z.boolean().default(false),
  turnstile_token: z.string().min(1).optional().nullable(),
});

async function verifyTurnstile(token: string | null | undefined, ip: string) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret || !token) return true;
  try {
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    form.append("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const j = await r.json().catch(() => ({ success: false }));
    return j.success !== false;
  } catch {
    return true;
  }
}

const money = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${Number(v).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: corsHeaders });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    // Keine Formulardaten loggen – nur Feldnamen.
    console.warn("validation failed", parsed.error.issues.map((i) => i.path.join(".")));
    return Response.json(
      { error: "validation_failed", message: "Bitte prüfen Sie Ihre Angaben." },
      { status: 400, headers: corsHeaders },
    );
  }
  const input = parsed.data;

  if (!(await verifyTurnstile(input.turnstile_token, ip))) {
    return Response.json({ error: "captcha_failed", message: "Sicherheitsprüfung fehlgeschlagen." }, { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1. Product Hub prüfen – manipulierte Werte werden nie übernommen.
  const { data: product } = await supabase
    .from("ph_products")
    .select("id,name,slug,model,product_group,applications,technology_claims,hero_image_url,offer_image_url,short_description,price_countries,status")
    .eq("id", input.product_hub_id)
    .maybeSingle();

  const info = product ? rentalInfo(product) : null;
  if (!product || !info || !["approved", "published"].includes(String(product.status))) {
    return Response.json(
      { error: "product_not_rentable", message: "Das gewählte Gerät ist aktuell nicht mietbar." },
      { status: 400, headers: corsHeaders },
    );
  }

  const exact = info.terms.find((t) => t.term === input.requested_term_months);
  const rental_price_snapshot = exact ? exact.monthly : info.from_monthly;
  const rental_deposit_snapshot = info.deposit_fixed ?? info.deposit_percent;
  const rental_deposit_mode = info.deposit_fixed ? "fixed" : "percent";
  const rental_delivery_days_snapshot = info.delivery_days;

  // 2. Kunden-Matching (E-Mail → Telefon → Firma) – keine Dubletten erzeugen.
  let matched_customer_id: string | null = null;
  let match_ambiguous = false;
  try {
    const { data: byEmail } = await supabase.from("customers").select("id").ilike("email", input.email).limit(2);
    if (byEmail?.length === 1) matched_customer_id = byEmail[0].id;
    else if ((byEmail?.length ?? 0) > 1) match_ambiguous = true;
    if (!matched_customer_id && !match_ambiguous) {
      const { data: byPhone } = await supabase.from("customers").select("id").eq("phone", input.mobile).limit(2);
      if (byPhone?.length === 1) matched_customer_id = byPhone[0].id;
      else if ((byPhone?.length ?? 0) > 1) match_ambiguous = true;
    }
    if (!matched_customer_id && !match_ambiguous && input.company_name) {
      const { data: byCo } = await supabase.from("customers").select("id").ilike("company_name", input.company_name).limit(2);
      if (byCo?.length === 1) matched_customer_id = byCo[0].id;
      else if ((byCo?.length ?? 0) > 1) match_ambiguous = true;
    }
  } catch (e) {
    console.warn("customer match failed", (e as Error).message);
  }

  const requestNumber = `MIET-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;

  const rental = {
    request_type: "rental",
    request_number: requestNumber,
    product_hub_id: product.id,
    product_name: product.name,
    product_image_url: info.image_url,
    rental_price_snapshot,
    rental_deposit_snapshot,
    rental_deposit_mode,
    rental_delivery_days_snapshot,
    rental_currency: info.currency,
    requested_term_months: input.requested_term_months,
    requested_start: input.requested_start,
    requested_start_date: input.requested_start_date || null,
    customer_type: input.customer_type,
    company_name: input.company_name,
    legal_form: input.legal_form,
    company_foundation_date: input.company_foundation_date,
    commercial_register: input.commercial_register,
    commercial_register_number: input.commercial_register_number,
    vat_id: input.vat_id,
    tax_number: input.tax_number,
    website: input.website,
    social_media: input.social_media,
    industry: input.industry,
    salutation: input.salutation,
    first_name: input.first_name,
    last_name: input.last_name,
    birth_date: input.birth_date,
    position: input.position,
    email: input.email,
    mobile: input.mobile,
    phone: input.phone,
    street: input.street,
    house_number: input.house_number,
    postal_code: input.postal_code,
    city: input.city,
    country: input.country,
    delivery_same: input.delivery_same,
    delivery_company: input.delivery_same ? input.company_name : input.delivery_company,
    delivery_contact: input.delivery_same ? `${input.first_name} ${input.last_name}` : input.delivery_contact,
    delivery_street: input.delivery_same ? input.street : input.delivery_street,
    delivery_house_number: input.delivery_same ? input.house_number : input.delivery_house_number,
    delivery_postal_code: input.delivery_same ? input.postal_code : input.delivery_postal_code,
    delivery_city: input.delivery_same ? input.city : input.delivery_city,
    delivery_country: input.delivery_same ? input.country : input.delivery_country,
    company_since: input.company_since,
    employees: input.employees,
    studio_open: input.studio_open,
    planned_opening_date: input.planned_opening_date,
    existing_devices: input.existing_devices,
    existing_devices_text: input.existing_devices_text,
    monthly_budget: input.monthly_budget,
    startup: input.startup,
    location_available: input.location_available,
    trade_registration_status: input.trade_registration_status,
    rental_start_mode: input.rental_start_mode,
    startup_support: input.startup_support,
    notes: input.notes,
    source_url: input.source_url,
    campaign: input.campaign,
    finder_result: input.finder_result,
    status: "NEUE MIETANFRAGE",
    customer_match: matched_customer_id ? "matched" : match_ambiguous ? "manuelle_pruefung" : "neu",
  };

  const summary = [
    `Mietanfrage ${requestNumber}`,
    `Gerät: ${product.name} (Product-Hub-ID ${product.id})`,
    `Mietpreis: ${money(rental_price_snapshot)} / Monat`,
    `Kaution: ${rental_deposit_mode === "fixed" ? money(Number(rental_deposit_snapshot)) : `${rental_deposit_snapshot} %`}`,
    `Lieferzeit: ${rental_delivery_days_snapshot ? `${rental_delivery_days_snapshot} Tage` : "auf Anfrage"}`,
    `Gewünschte Laufzeit: ${input.requested_term_months} Monate`,
    `Mietbeginn: ${input.requested_start}${input.requested_start_date ? ` (${input.requested_start_date})` : ""}`,
    `Kundentyp: ${input.customer_type}`,
    `Branche: ${input.industry || "—"}`,
    `Budget: ${input.monthly_budget || "—"}`,
    `Anschrift: ${input.street} ${input.house_number}, ${input.postal_code} ${input.city}, ${input.country}`,
    input.delivery_same ? "Lieferanschrift: identisch" : `Lieferanschrift: ${rental.delivery_street} ${rental.delivery_house_number}, ${rental.delivery_postal_code} ${rental.delivery_city}, ${rental.delivery_country}`,
    input.notes ? `Bemerkung: ${input.notes}` : "",
  ].filter(Boolean).join("\n");

  const { data: lead, error } = await supabase
    .from("sales_leads")
    .insert({
      source: "ALIX Mietanfrage",
      form_name: "ALIX Premium Mietanfrage",
      external_id: requestNumber,
      first_name: input.first_name,
      last_name: input.last_name,
      company: input.company_name || null,
      email: input.email,
      phone: input.mobile,
      street: `${input.street} ${input.house_number}`.trim(),
      zip: input.postal_code,
      city: input.city,
      country: input.country,
      requested_products: product.name,
      message: summary,
      notes: summary,
      interests: ["Miete"],
      additional_interests: [`Gerät: ${product.name}`, `Laufzeit: ${input.requested_term_months} Monate`],
      delivery_preference: input.requested_start,
      consent_data: true,
      consent_contact: input.consent_contact,
      lead_status: "NEUE MIETANFRAGE",
      converted_customer_id: matched_customer_id,
      metadata: { rental, ip_country: null },
    })
    .select("id")
    .single();

  if (error || !lead) {
    console.error("rental lead insert failed", error?.message);
    return Response.json({ error: "insert_failed", message: "Speichern fehlgeschlagen." }, { status: 500, headers: corsHeaders });
  }

  // Wiedervorlage für den Vertrieb
  try {
    await supabase.from("sales_followups").insert({
      lead_id: lead.id,
      type: "Rückruf",
      title: `Mietanfrage prüfen – ${product.name}`,
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: "Offen",
    });
  } catch (e) {
    console.warn("followup failed", (e as Error).message);
  }

  // Interne Benachrichtigung
  try {
    const { data: users } = await supabase
      .from("user_roles").select("user_id").in("role", ["Vertrieb", "Vertriebsleitung", "Admin", "Super Admin"]);
    const ids = Array.from(new Set((users || []).map((r) => r.user_id)));
    if (ids.length) {
      await supabase.from("mail_notifications").insert(
        ids.map((uid) => ({
          user_id: uid,
          title: `Neue Mietanfrage – ${product.name}`,
          body: `${input.first_name} ${input.last_name}${input.company_name ? " · " + input.company_name : ""} – ${money(rental_price_snapshot)}/Monat, ${input.requested_term_months} Monate`,
          link: `/verkauf/anfragen/${lead.id}`,
          kind: "sales_lead",
          read: false,
        })),
      );
    }
  } catch (e) {
    console.warn("notify failed", (e as Error).message);
  }

  // Bestätigungsmail an den Kunden + interne Kopie an den Vertrieb (bestehender Resend-Versand)
  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const depositText = rental_deposit_mode === "fixed"
        ? money(Number(rental_deposit_snapshot))
        : `${rental_deposit_snapshot} %`;
      const customerHtml = `
        <p>Vielen Dank für Ihre Anfrage.</p>
        <p><strong>Gerät:</strong> ${product.name}<br/>
        <strong>Mietpreis:</strong> ${money(rental_price_snapshot)} / Monat<br/>
        <strong>Kaution:</strong> ${depositText}<br/>
        <strong>Gewünschte Mietdauer:</strong> ${input.requested_term_months} Monate<br/>
        <strong>Mietbeginn:</strong> ${input.requested_start}<br/>
        <strong>Anfragenummer:</strong> ${requestNumber}</p>
        <p>Dies ist noch keine Annahme und kein Mietvertrag. Das ALIX-Team prüft die Anfrage und meldet sich bei Ihnen.</p>`;
      const internalHtml = `
        <p><strong>Neue Mietanfrage ${requestNumber}</strong></p>
        <pre style="font-family:inherit;white-space:pre-wrap">${summary}</pre>
        <p><a href="https://alixwork.de/verkauf/anfragen/${lead.id}">MIETANFRAGE ÖFFNEN</a></p>`;
      const send = (to: string, subject: string, html: string) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "Alix Lasers ® <noreply@alixlasers.ai>", to: [to], subject, html }),
        });
      await send(input.email, `Ihre Mietanfrage bei ALIX LASERS – ${product.name}`, customerHtml);
      await send("rde@alix-operation.de", `Neue Mietanfrage – ${product.name}`, internalHtml);
    }
  } catch (e) {
    console.warn("customer mail failed", (e as Error).message);
  }


  try {
    await supabase.from("integration_logs").insert({
      source: "ALIX Mietanfrage",
      kind: "rental_request_submit",
      status: "ok",
      payload: { lead_id: lead.id, request_number: requestNumber, product_hub_id: product.id },
    });
  } catch { /* ignore */ }

  return Response.json(
    {
      ok: true,
      lead_id: lead.id,
      request_number: requestNumber,
      rental_price_snapshot,
      rental_deposit_snapshot,
      rental_deposit_mode,
      rental_delivery_days_snapshot,
    },
    { headers: corsHeaders },
  );
});
