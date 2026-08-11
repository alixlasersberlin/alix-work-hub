import "../_shared/global-bcc.ts";
// Phase 3 – Öffentliche Terminbestätigung (kein Login, nur Einmal-Token).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const BCC = ["rde@alix-lasers.com", "k.trinh@alix-operation.de", "jh@alix-operation.de"];
const BCC_STR = BCC.join(", ");

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function sha256(v: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const RESPONSE_STATUS: Record<string, string> = {
  confirm: "kunde_bestaetigt",
  reject: "kunde_abgelehnt",
  alternative: "kunde_alternativtermin",
  callback: "kunde_alternativtermin",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const body = await req.json().catch(() => ({}));
    const action: string = body?.action || "get";
    const token: string = String(body?.token || "");
    if (token.length < 20) return Response.json({ error: "Ungültiger Link" }, { status: 400, headers: corsHeaders });

    const hash = await sha256(token);
    const { data: tok } = await sb
      .from("delivery_confirmation_tokens")
      .select("*")
      .eq("token_hash", hash)
      .maybeSingle();

    if (!tok || tok.revoked) return Response.json({ error: "Dieser Link ist nicht mehr gültig." }, { status: 404, headers: corsHeaders });
    if (tok.expires_at && new Date(tok.expires_at) < new Date()) {
      return Response.json({ error: "Dieser Link ist abgelaufen. Bitte kontaktieren Sie uns." }, { status: 410, headers: corsHeaders });
    }

    const { data: appt } = await sb.from("delivery_appointments").select("*").eq("id", tok.appointment_id).maybeSingle();
    if (!appt) return Response.json({ error: "Termin nicht gefunden" }, { status: 404, headers: corsHeaders });

    const publicAppt = {
      id: appt.id,
      order_number: appt.order_number,
      customer_name: appt.customer_name,
      company_name: appt.company_name,
      contact_name: appt.contact_name,
      contact_phone: appt.contact_phone ?? appt.contact_mobile,
      appointment_type: appt.appointment_type,
      status: appt.status,
      planned_date: appt.planned_date,
      time_window_start: appt.time_window_start,
      time_window_end: appt.time_window_end,
      promised_window: appt.promised_window,
      device_name: appt.device_name ?? appt.article_name,
      scope_of_delivery: appt.scope_of_delivery,
      requires_training: appt.requires_training,
      delivery_street: appt.delivery_street,
      delivery_zip: appt.delivery_zip,
      delivery_city: appt.delivery_city,
      delivery_country: appt.delivery_country,
      already_answered: !!tok.used_at,
    };

    if (action === "get") {
      if (!tok.opened_at) {
        await sb.from("delivery_confirmation_tokens").update({ opened_at: new Date().toISOString() }).eq("id", tok.id);
        if (appt.status === "bestaetigung_versendet") {
          await sb.from("delivery_appointments").update({ status: "kunde_geoeffnet" }).eq("id", appt.id);
          await sb.from("delivery_status_history").insert({
            appointment_id: appt.id, from_status: appt.status, to_status: "kunde_geoeffnet", source: "kundenportal",
          }).then(() => {}, () => {});
        }
      }
      return Response.json({ ok: true, appointment: publicAppt }, { headers: corsHeaders });
    }

    if (action !== "submit") return Response.json({ error: "Unbekannte Aktion" }, { status: 400, headers: corsHeaders });
    if (tok.used_at) return Response.json({ error: "Sie haben bereits geantwortet." }, { status: 409, headers: corsHeaders });

    const response: string = String(body?.response || "");
    if (!RESPONSE_STATUS[response]) return Response.json({ error: "Ungültige Antwort" }, { status: 400, headers: corsHeaders });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent") ?? null;
    const trim = (v: unknown, max = 500) => (v == null ? null : String(v).slice(0, max));

    const { data: conf } = await sb.from("delivery_confirmations").insert({
      appointment_id: appt.id,
      response,
      alternative_date: body?.alternativeDate || null,
      alternative_window_start: body?.alternativeStart || null,
      alternative_window_end: body?.alternativeEnd || null,
      callback_requested: response === "callback" || !!body?.callbackRequested,
      comment: trim(body?.comment, 2000),
      contact_name: trim(body?.contactName, 200),
      contact_phone: trim(body?.contactPhone, 80),
      corrected_address: trim(body?.correctedAddress, 400),
      ip_address: ip,
      user_agent: trim(ua, 400),
    }).select("id").maybeSingle();

    const nextStatus = RESPONSE_STATUS[response];
    const patch: Record<string, unknown> = { status: nextStatus };
    if (response === "confirm") { patch.confirmed_at = new Date().toISOString(); patch.confirmed_channel = "portal"; }
    if (body?.contactPhone) patch.contact_phone = trim(body.contactPhone, 80);
    if (body?.contactName) patch.contact_name = trim(body.contactName, 200);
    if (body?.comment) patch.customer_notes = trim(body.comment, 2000);
    await sb.from("delivery_appointments").update(patch).eq("id", appt.id);

    await sb.from("delivery_confirmation_tokens").update({ used_at: new Date().toISOString() }).eq("id", tok.id);

    await sb.from("delivery_status_history").insert({
      appointment_id: appt.id,
      from_status: appt.status,
      to_status: nextStatus,
      source: "kundenportal",
      note: trim(body?.comment, 500),
    }).then(() => {}, () => {});

    // Teamkalender aktualisieren (grün = bestätigt)
    if (appt.esc_event_id) {
      await sb.from("esc_events").update({
        confirmation_status: response === "confirm" ? "confirmed" : "declined",
        title: response === "confirm"
          ? `Auslieferung (bestätigt): ${appt.customer_name ?? ""} – ${appt.order_number ?? ""}`
          : `Auslieferung (Rückmeldung Kunde): ${appt.customer_name ?? ""} – ${appt.order_number ?? ""}`,
      }).eq("id", appt.esc_event_id).then(() => {}, () => {});
    }

    // Interne Benachrichtigung
    await sb.from("delivery_notifications").insert({
      appointment_id: appt.id,
      event_type: `customer_${response}`,
      title: `Kundenrückmeldung: ${appt.customer_name ?? ""} (${appt.order_number ?? "-"})`,
      body: [
        `Antwort: ${response}`,
        body?.alternativeDate ? `Alternativtermin: ${body.alternativeDate}` : null,
        body?.comment ? `Bemerkung: ${trim(body.comment, 500)}` : null,
      ].filter(Boolean).join(" | "),
      target_role: "Tourenplanung",
      channel: "app",
    }).then(() => {}, () => {});

    if (RESEND_API_KEY) {
      const html = `<div style="font-family:Arial;font-size:14px">
        <p><b>${esc(appt.customer_name)}</b> (Auftrag ${esc(appt.order_number)}) hat auf den Liefertermin geantwortet:</p>
        <p><b>${esc(response)}</b></p>
        ${body?.alternativeDate ? `<p>Alternativtermin: ${esc(body.alternativeDate)} ${esc(body?.alternativeStart ?? "")}–${esc(body?.alternativeEnd ?? "")}</p>` : ""}
        ${body?.correctedAddress ? `<p>Adresskorrektur: ${esc(body.correctedAddress)}</p>` : ""}
        ${body?.contactPhone ? `<p>Telefon: ${esc(body.contactPhone)}</p>` : ""}
        ${body?.comment ? `<p>Bemerkung: ${esc(body.comment)}</p>` : ""}
      </div>`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Alix Lasers ® <noreply@alixlasers.ai>",
          to: ["tour@alix-lasers.com"],
          bcc: [...([] as string[]).concat(BCC as any), "service@alix-lasers.com"],
          subject: `Kundenrückmeldung Liefertermin – ${appt.customer_name ?? ""} (${appt.order_number ?? "-"})`,
          html,
        }),
      }).catch(() => {});
      await sb.from("delivery_email_logs").insert({
        appointment_id: appt.id, kind: "customer_response", recipient: "tour@alix-lasers.com",
        bcc: BCC_STR, subject: "Kundenrückmeldung Liefertermin", status: "sent", sent_at: new Date().toISOString(),
      }).then(() => {}, () => {});
    }

    // Dedizierte Benachrichtigung bei bestätigtem Liefertermin
    if (RESEND_API_KEY && response === "confirm") {
      const CONFIRM_TO = ["k.trinh@alix-operation.de", "jh@alix-operation.de"];
      const dateStr = appt.planned_date
        ? new Date(appt.planned_date).toLocaleDateString("de-DE")
        : "-";
      const win = [appt.time_window_start, appt.time_window_end].filter(Boolean).join(" – ");
      const chtml = `<div style="font-family:Arial;font-size:14px">
        <p><b>Liefertermin bestätigt</b></p>
        <p>Kunde: <b>${esc(appt.customer_name)}</b>${appt.company_name ? ` (${esc(appt.company_name)})` : ""}<br/>
        Auftrag: <b>${esc(appt.order_number ?? "-")}</b><br/>
        Termin: <b>${esc(dateStr)}</b>${win ? ` (${esc(win)})` : ""}<br/>
        Gerät: ${esc(appt.device_name ?? appt.article_name ?? "-")}<br/>
        Adresse: ${esc([appt.delivery_street, `${appt.delivery_zip ?? ""} ${appt.delivery_city ?? ""}`.trim(), appt.delivery_country].filter(Boolean).join(", "))}</p>
        ${body?.contactName ? `<p>Ansprechpartner: ${esc(body.contactName)}</p>` : ""}
        ${body?.contactPhone ? `<p>Telefon: ${esc(body.contactPhone)}</p>` : ""}
        ${body?.comment ? `<p>Bemerkung: ${esc(body.comment)}</p>` : ""}
      </div>`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Alix Lasers ® <noreply@alixlasers.ai>",
          bcc: ["service@alix-lasers.com"],
          to: CONFIRM_TO,
          subject: `Liefertermin bestätigt – ${appt.customer_name ?? ""} (${appt.order_number ?? "-"}) am ${dateStr}`,
          html: chtml,
        }),
      }).catch(() => {});
      await sb.from("delivery_email_logs").insert({
        appointment_id: appt.id, kind: "delivery_confirmed_internal", recipient: CONFIRM_TO.join(", "),
        subject: "Liefertermin bestätigt", status: "sent", sent_at: new Date().toISOString(),
      }).then(() => {}, () => {});
    }

    return Response.json({ ok: true, confirmation_id: conf?.id ?? null, status: nextStatus }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: String((e as Error).message ?? e) }, { status: 500, headers: corsHeaders });
  }
});