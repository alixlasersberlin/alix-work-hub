// Zoho Forms inbound webhook → sales_leads
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_KEY = Deno.env.get("ZOHO_FORMS_WEBHOOK_KEY") ?? "";

function pick(obj: Record<string, any>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim().length > 0) {
      return String(v).trim();
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  try {
    const provided = req.headers.get("x-api-key") ?? "";
    if (!SHARED_KEY || provided !== SHARED_KEY) {
      await supabase.from("integration_logs").insert({
        source: "zoho_forms",
        event: "webhook_auth_failed",
        status: "error",
        message: "Invalid or missing x-api-key",
      });
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({} as any));
    const data: Record<string, any> = body?.data ?? body ?? {};

    const external_id =
      pick(data, ["id", "form_id", "submission_id", "record_id", "ZF_id"]) ??
      crypto.randomUUID();
    const form_name = pick(data, ["form_name", "formName", "form", "source_form"]);
    const first_name = pick(data, ["first_name", "firstName", "vorname", "Vorname"]);
    const last_name = pick(data, ["last_name", "lastName", "nachname", "Nachname"]);
    const full_name = pick(data, ["name", "full_name", "ansprechpartner", "Name"]);
    let fn = first_name;
    let ln = last_name;
    if (!fn && !ln && full_name) {
      const parts = full_name.split(/\s+/);
      fn = parts[0];
      ln = parts.slice(1).join(" ") || null;
    }
    const company = pick(data, ["company", "firma", "Firma", "company_name", "organization"]);
    const email = pick(data, ["email", "Email", "e_mail", "E_Mail"]);
    const phone = pick(data, ["phone", "telefon", "Telefon", "mobile", "Mobil"]);
    const street = pick(data, ["street", "strasse", "Strasse", "address", "address1"]);
    const zip = pick(data, ["zip", "plz", "PLZ", "postal_code", "postcode"]);
    const city = pick(data, ["city", "ort", "Ort", "town"]);
    const country = pick(data, ["country", "land", "Land"]);
    const requested_products = pick(data, [
      "product",
      "products",
      "produktinteresse",
      "Produktinteresse",
      "interest",
      "geraet",
    ]);
    const message = pick(data, ["message", "nachricht", "Nachricht", "comment", "kommentar"]);

    const payload = {
      external_id,
      source: "zoho_forms",
      form_name,
      first_name: fn,
      last_name: ln,
      company,
      email: email?.toLowerCase() ?? null,
      phone,
      street,
      zip,
      city,
      country,
      requested_products,
      message,
      lead_status: "Importiert - Angebot offen",
      metadata: data,
      updated_at: new Date().toISOString(),
    };

    const { data: upserted, error: upErr } = await supabase
      .from("sales_leads")
      .upsert(payload, { onConflict: "source,external_id" })
      .select("id")
      .single();

    if (upErr) throw upErr;

    await supabase.from("integration_logs").insert({
      source: "zoho_forms",
      event: "lead_upserted",
      external_id,
      status: "ok",
      message: `Lead ${upserted?.id}`,
      payload: data,
    });

    // In-App-Benachrichtigung an Vertriebs-Rollen
    const { data: notifyUsers } = await supabase
      .from("user_roles")
      .select("user_id, roles!inner(name)")
      .in("roles.name", ["Super Admin", "Admin", "Vertriebsleitung", "Vertrieb"]);

    const uniqUsers = [...new Set((notifyUsers ?? []).map((r: any) => r.user_id))];
    if (uniqUsers.length > 0) {
      await supabase.from("mail_notifications").insert(
        uniqUsers.map((uid) => ({
          user_id: uid,
          type: "sales_lead",
          title: "Neue Vertriebsanfrage eingegangen",
          body: `${company ?? [fn, ln].filter(Boolean).join(" ") ?? "Neue Anfrage"} – ${requested_products ?? form_name ?? "Zoho Forms"}`,
          link: `/verkauf/anfragen/${upserted?.id}`,
          is_read: false,
        })),
      );
    }

    return new Response(JSON.stringify({ ok: true, lead_id: upserted?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    await supabase.from("integration_logs").insert({
      source: "zoho_forms",
      event: "webhook_error",
      status: "error",
      message: e?.message ?? String(e),
    });
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
