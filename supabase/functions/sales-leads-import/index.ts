// Generischer Sales-Lead Import (Website / API / WhatsApp / Telefon)
// Auth via Header `x-api-key` (Secret SALES_LEADS_API_KEY)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_KEY = Deno.env.get("SALES_LEADS_API_KEY") ?? "";

function s(v: any): string | null {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t.length === 0 ? null : t;
}

function asArray(v: any): string[] | null {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const t = String(v).trim();
  if (!t) return null;
  return t.split(/[;,|]/).map((x) => x.trim()).filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const provided = req.headers.get("x-api-key") ?? "";
    if (!SHARED_KEY || provided !== SHARED_KEY) {
      await supabase.from("integration_logs").insert({
        source: "sales_leads_api",
        event: "auth_failed",
        status: "error",
        message: "Invalid or missing x-api-key",
      });
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({} as any));
    // Akzeptiert flache + verschachtelte Struktur
    const customer = body?.customer ?? {};
    const project = body?.project ?? {};
    const details = body?.lead_details ?? {};

    let fn = s(customer.first_name ?? body.first_name);
    let ln = s(customer.last_name ?? body.last_name);
    const fullName = s(customer.name ?? body.name);
    if (!fn && !ln && fullName) {
      const parts = fullName.split(/\s+/);
      fn = parts[0]; ln = parts.slice(1).join(" ") || null;
    }

    const sourceRaw = s(body.lead_source ?? body.source) ?? "api";
    const sourceKey = sourceRaw.toLowerCase().includes("whatsapp") ? "whatsapp"
      : sourceRaw.toLowerCase().includes("telef") || sourceRaw.toLowerCase().includes("phone") ? "phone"
      : sourceRaw.toLowerCase().includes("web") ? "website"
      : sourceRaw.toLowerCase().includes("form") ? "zoho_forms"
      : "api";

    const ratingRaw = details.rating ?? body.rating;
    const service_rating = ratingRaw != null ? Math.max(1, Math.min(5, parseInt(String(ratingRaw), 10))) || null : null;

    const payload: any = {
      external_id: s(body.external_id) ?? crypto.randomUUID(),
      source: sourceKey,
      form_name: s(body.form_name ?? sourceRaw),
      first_name: fn,
      last_name: ln,
      company: s(customer.company ?? body.company),
      email: s(customer.email ?? body.email)?.toLowerCase() ?? null,
      phone: s(customer.phone ?? body.phone),
      street: s(customer.street ?? body.street),
      zip: s(customer.zip ?? body.zip),
      city: s(customer.city ?? body.city),
      country: s(customer.country ?? body.country),
      device_category: s(project.device_category ?? body.device_category),
      additional_services: asArray(project.additional_services ?? body.additional_services) ?? [],
      customer_goal: s(project.customer_goal ?? body.customer_goal),
      implementation_period: s(project.implementation_period ?? body.implementation_period),
      requested_products: s(body.requested_products),
      message: s(body.message),
      notes: s(details.note ?? body.note),
      service_rating,
      lead_status: s(body.lead_status) ?? "Neu",
      metadata: body,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("sales_leads")
      .upsert(payload, { onConflict: "source,external_id" })
      .select("id, lead_number")
      .single();
    if (insErr) throw insErr;

    await supabase.from("integration_logs").insert({
      source: "sales_leads_api",
      event: "lead_upserted",
      external_id: payload.external_id,
      status: "ok",
      message: `Lead ${inserted?.id} (${inserted?.lead_number})`,
      payload: body,
    });

    // In-App-Notification an Vertrieb
    try {
      const { data: notifyUsers } = await supabase
        .from("user_roles")
        .select("user_id, roles!inner(name)")
        .in("roles.name", ["Super Admin", "Admin", "Vertriebsleitung", "Vertrieb"]);
      const uniq = [...new Set((notifyUsers ?? []).map((r: any) => r.user_id))];
      if (uniq.length) {
        await supabase.from("mail_notifications").insert(uniq.map((uid) => ({
          user_id: uid,
          type: "sales_lead",
          title: `Neue Anfrage (${sourceRaw})`,
          body: `${payload.company ?? [fn, ln].filter(Boolean).join(" ") ?? "Neue Anfrage"} – ${payload.device_category ?? payload.requested_products ?? sourceRaw}`,
          link: `/verkauf/anfragen/${inserted?.id}`,
          is_read: false,
        })));
      }
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ ok: true, lead_id: inserted?.id, lead_number: inserted?.lead_number }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    await supabase.from("integration_logs").insert({
      source: "sales_leads_api",
      event: "import_error",
      status: "error",
      message: e?.message ?? String(e),
    });
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
