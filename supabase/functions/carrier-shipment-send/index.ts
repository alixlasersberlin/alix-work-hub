import "../_shared/global-bcc.ts";
// Speditionsversand – E-Mail an Spedition (Frachtauftrag) oder an den Kunden (Versandavis).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const BCC = "rde@alix-lasers.com";
const CUSTOMER_CC = "K.trinh@alix-operation.de";

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const [y, m, d] = String(v).slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : String(v);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userSb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userSb.auth.getUser();
    if (!userData?.user) return json({ error: "Nicht angemeldet" }, 401);

    const body = await req.json().catch(() => ({}));
    const assignmentId = String(body?.assignment_id ?? "");
    const mode = String(body?.mode ?? "carrier");
    if (!assignmentId) return json({ error: "assignment_id fehlt" }, 400);
    if (!["carrier", "customer"].includes(mode)) return json({ error: "mode ungültig" }, 400);
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY nicht konfiguriert" }, 500);
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY nicht konfiguriert" }, 500);

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: row, error } = await sb
      .from("delivery_carrier_assignments")
      .select("*, carrier:carrier_id(name, contact_name, email, phone), appointment:appointment_id(order_number, customer_name, company_name, device_name, serial_number, contact_name, contact_email, delivery_street, delivery_zip, delivery_city, delivery_country, planned_date), route_plan:route_plan_id(order_id, planned_date, contact_name, contact_email, device_model, device_serial_number, location_address, order:order_id(order_number, customer:customer_id(company_name, contact_name, email)))")
      .eq("id", assignmentId)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!row) return json({ error: "Speditionsversand nicht gefunden" }, 404);

    const rp: any = (row as any).route_plan ?? {};
    const a: any = {
      ...(row.appointment ?? {}),
    };
    const rpCust: any = rp.order?.customer ?? {};
    a.order_number = a.order_number || rp.order?.order_number || null;
    a.customer_name = a.customer_name || rpCust.company_name || rpCust.contact_name || null;
    a.contact_name = a.contact_name || rp.contact_name || rpCust.contact_name || null;
    a.contact_email = a.contact_email || rp.contact_email || rpCust.email || null;
    a.device_name = a.device_name || rp.device_model || null;
    a.serial_number = a.serial_number || rp.device_serial_number || null;
    a.planned_date = a.planned_date || rp.planned_date || null;
    const c: any = row.carrier ?? {};
    const to = mode === "carrier" ? c.email : a.contact_email;
    if (!to) {
      return json({ error: mode === "carrier" ? "Für diese Spedition ist keine E-Mail hinterlegt." : "Für diesen Auftrag ist keine Kunden-E-Mail hinterlegt." }, 400);
    }

    const rpAddr = typeof rp.location_address === "string"
      ? rp.location_address
      : [rp.location_address?.street, [rp.location_address?.zip, rp.location_address?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const addr = [a.delivery_street, [a.delivery_zip, a.delivery_city].filter(Boolean).join(" "), a.delivery_country].filter(Boolean).join(", ") || rpAddr;
    let subject: string;
    let html: string;

    if (mode === "carrier") {
      subject = `Frachtauftrag ${a.order_number ?? ""} – Abholung ${fmtDate(row.assigned_date)}`.trim();
      html = `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
          <h2>Frachtauftrag</h2>
          <p>Guten Tag${c.contact_name ? " " + esc(c.contact_name) : ""},</p>
          <p>wir bitten um Abholung und Zustellung der folgenden Sendung:</p>
          <table cellpadding="6" style="border-collapse:collapse">
            <tr><td><b>Auftrag</b></td><td>${esc(a.order_number ?? "—")}</td></tr>
            <tr><td><b>Gerät</b></td><td>${esc(a.device_name ?? "—")}${a.serial_number ? " · SN " + esc(a.serial_number) : ""}</td></tr>
            <tr><td><b>Abholdatum</b></td><td>${esc(fmtDate(row.assigned_date))}</td></tr>
            <tr><td><b>Empfänger</b></td><td>${esc(a.company_name || a.customer_name || "—")}</td></tr>
            <tr><td><b>Lieferadresse</b></td><td>${esc(addr || "—")}</td></tr>
            <tr><td><b>Wunschtermin</b></td><td>${esc(fmtDate(a.planned_date))}</td></tr>
            ${row.agreed_price != null ? `<tr><td><b>Preis</b></td><td>${esc(Number(row.agreed_price).toFixed(2))} ${esc(row.currency ?? "EUR")}</td></tr>` : ""}
          </table>
          ${row.notes ? `<p><b>Hinweise:</b><br>${esc(row.notes).replace(/\n/g, "<br>")}</p>` : ""}
          <p>Bitte senden Sie uns nach Beauftragung die Sendungsnummer zurück.</p>
          <p style="color:#666">Empfindliches medizinisches Gerät – bitte stoßfrei transportieren und vor Nässe schützen.</p>
          <p>Freundliche Grüße<br>Alix Auslieferung</p>
        </div>`;
    } else {
      subject = `Ihre Sendung wurde abgeholt – Auftrag ${a.order_number ?? ""}`.trim();
      html = `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
          <h2>Ihre Sendung ist unterwegs</h2>
          <p>Guten Tag${a.contact_name ? " " + esc(a.contact_name) : ""},</p>
          <p>Ihr Gerät wurde von unserer Spedition abgeholt und ist jetzt zu Ihnen unterwegs.</p>
          <table cellpadding="6" style="border-collapse:collapse">
            <tr><td><b>Auftrag</b></td><td>${esc(a.order_number ?? "—")}</td></tr>
            <tr><td><b>Gerät</b></td><td>${esc(a.device_name ?? "—")}${a.serial_number ? " · SN " + esc(a.serial_number) : ""}</td></tr>
            <tr><td><b>Spedition</b></td><td>${esc(c.name ?? "—")}</td></tr>
            <tr><td><b>Sendungsnummer</b></td><td>${esc(row.tracking_number ?? "wird nachgereicht")}</td></tr>
            <tr><td><b>Abholdatum</b></td><td>${esc(fmtDate(row.assigned_date))}</td></tr>
            <tr><td><b>Lieferadresse</b></td><td>${esc(addr || "—")}</td></tr>
          </table>
          <p>Die Spedition meldet sich zur Terminabstimmung bei Ihnen.</p>
          <p>Freundliche Grüße<br>Ihr Alix Team</p>
        </div>`;
    }

    let status = "sent";
    let providerId: string | null = null;
    let errText: string | null = null;
    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Alix Lasers ® <noreply@alixlasers.ai>",
        to: [to],
        ...(mode === "customer" ? { cc: [CUSTOMER_CC] } : {}),
        bcc: [...([] as string[]).concat([BCC] as any), "service@alix-lasers.com"],
        subject,
        html,
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      status = "failed";
      errText = out?.message || `HTTP ${res.status}`;
    }
    providerId = out?.id ?? null;

    await sb.from("delivery_email_logs").insert({
      kind: mode === "carrier" ? "carrier_freight_order" : "carrier_shipping_notice",
      appointment_id: row.appointment_id,
      recipient: to,
      bcc: BCC,
      subject,
      status,
      provider_id: providerId,
      error: errText,
      sent_at: new Date().toISOString(),
    }).then(() => {}, () => {});

    if (status === "failed") return json({ error: errText }, 502);
    return json({ ok: true, recipient: to });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});