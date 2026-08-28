// delivery-notify
// Sendet eine Kundenbenachrichtigung zum Lieferstatus (Delivery Journey).
// Vorlagen sind admin-editierbar in app_settings (key: delivery_journey_mail_templates).
import "../_shared/global-bcc.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMail } from "../_shared/portal-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PHASE_LABELS: Record<string, string> = {
  order_received: "Auftrag eingegangen",
  order_check: "Auftragsprüfung",
  production_planned: "Produktion geplant",
  in_production: "In Produktion",
  qc: "Qualitätsprüfung",
  provisioning: "Bereitstellung",
  tour_planning: "Tourenplanung",
  out_for_delivery: "Auslieferung",
  delivered: "Geliefert",
};

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string; enabled: boolean }> = {
  _default: {
    subject: "Ihr Auftrag {{auftragsnummer}}: {{phase}}",
    body:
      "Guten Tag {{kunde}},\n\nIhr Auftrag {{auftragsnummer}} befindet sich jetzt im Status: {{phase}}.\n\nVoraussichtlicher Liefertermin: {{termin}}\n\nDen aktuellen Status können Sie jederzeit in unserem Kundenportal einsehen.\n\nFreundliche Grüße\nAlix Lasers ®",
    enabled: true,
  },
};

function fill(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? "");
}

function fmtDate(v: string | null) {
  if (!v) return "wird geplant";
  try {
    return new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "wird geplant";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const isService = authHeader.includes(SERVICE_ROLE);
    if (!isService) {
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: u } = await userClient.auth.getUser();
      if (!u?.user) return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const orderId = body?.order_id as string | undefined;
    if (!orderId) return json({ error: "order_id fehlt" }, 400);

    const [{ data: order }, { data: status }, { data: setting }] = await Promise.all([
      admin.from("orders").select("id, order_number, customer_id, expected_shipment_date").eq("id", orderId).maybeSingle(),
      admin.from("order_delivery_status").select("*").eq("order_id", orderId).maybeSingle(),
      admin.from("app_settings").select("value").eq("key", "delivery_journey_mail_templates").maybeSingle(),
    ]);
    if (!order) return json({ error: "Auftrag nicht gefunden" }, 404);

    let customerName = "";
    let customerEmail = body?.to as string | undefined;
    if (order.customer_id) {
      const { data: c } = await admin
        .from("customers")
        .select("email, company_name, contact_name")
        .eq("id", order.customer_id)
        .maybeSingle();
      customerName = (c as any)?.contact_name || (c as any)?.company_name || "";
      customerEmail = customerEmail || (c as any)?.email || undefined;
    }
    if (!customerEmail) return json({ error: "Keine Empfänger-E-Mail hinterlegt" }, 400);

    let templates: Record<string, { subject: string; body: string; enabled?: boolean }> = {};
    try {
      const raw = (setting as any)?.value;
      templates = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
    } catch { templates = {}; }

    const phase = String(body?.phase || status?.phase || "order_received");
    const tpl = templates[phase] ?? templates["_default"] ?? DEFAULT_TEMPLATES._default;
    if (tpl.enabled === false && !body?.force) return json({ skipped: true, reason: "template_disabled" });

    const vars = {
      kunde: customerName || "Kundin/Kunde",
      auftragsnummer: order.order_number ?? "",
      phase: PHASE_LABELS[phase] ?? phase,
      termin: fmtDate(status?.eta_planned ?? order.expected_shipment_date ?? null),
      grund: status?.customer_delay_reason ?? "",
      hinweis: status?.customer_note ?? "",
    };

    const subject = fill(tpl.subject || DEFAULT_TEMPLATES._default.subject, vars);
    const text = fill(tpl.body || DEFAULT_TEMPLATES._default.body, vars);
    const html = text
      .split(/\n{2,}/)
      .map((p) => `<p style="margin:0 0 12px 0">${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");

    await sendMail(customerEmail, subject, `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">${html}</div>`);

    await admin.from("order_delivery_events").insert({
      order_id: orderId,
      event_type: "notification",
      title: `Statusinformation versendet: ${vars.phase}`,
      description: `E-Mail an ${customerEmail}`,
      visible_to_customer: false,
    }).then(() => {}, () => {});

    return json({ ok: true, to: customerEmail, subject });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
