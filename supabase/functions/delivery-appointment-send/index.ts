// Phase 3 – Liefertermin-Bestätigung: Token erzeugen + E-Mails versenden.
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
const BCC = ["rde@alix-lasers.com", "k.trinh@alix-operation.de", "jh@alix-operation.de"];
const BCC_STR = BCC.join(", ");

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function sha256(v: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fmtDate(d?: string | null) {
  if (!d) return "noch offen";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

function fmtWindow(a: any) {
  const s = (a.time_window_start || "").slice(0, 5);
  const e = (a.time_window_end || "").slice(0, 5);
  if (s && e) return `${s} – ${e} Uhr`;
  if (s) return `ab ${s} Uhr`;
  return a.promised_window || "wird noch mitgeteilt";
}

async function sendMail(sb: any, log: Record<string, unknown>, opts: { to: string[]; subject: string; html: string }) {
  if (!RESEND_API_KEY || opts.to.length === 0) return;
  let status = "sent";
  let providerId: string | null = null;
  let error: string | null = null;
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Alix Auslieferung <no-reply@alixwork.de>",
        to: opts.to,
        bcc: BCC,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) { status = "failed"; error = out?.message || `HTTP ${res.status}`; }
    providerId = out?.id ?? null;
  } catch (e) {
    status = "failed";
    error = String((e as Error).message ?? e);
  }
  await sb.from("delivery_email_logs").insert({
    ...log,
    recipient: opts.to.join(", "),
    bcc: BCC,
    subject: opts.subject,
    status,
    provider_id: providerId,
    error,
    sent_at: new Date().toISOString(),
  }).then(() => {}, () => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userSb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userSb.auth.getUser();
    if (!u?.user) return Response.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders });

    const roleChecks = await Promise.all(
      ["Super Admin", "Admin", "Tourenplanung", "Order", "Operations"].map((r) => userSb.rpc("has_role", { check_role: r })),
    );
    if (!roleChecks.some((r) => !!r.data)) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const appointmentId: string = body?.appointmentId;
    let baseUrl: string = (body?.baseUrl || "https://app.alixwork.de").replace(/\/+$/, "");
    // Never expose Lovable infrastructure domains in customer emails
    if (/lovable|supabase/i.test(baseUrl)) baseUrl = "https://app.alixwork.de";
    const validDays: number = Number(body?.validDays ?? 14);
    if (!appointmentId) return Response.json({ error: "appointmentId erforderlich" }, { status: 400, headers: corsHeaders });

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: appt } = await sb.from("delivery_appointments").select("*").eq("id", appointmentId).maybeSingle();
    if (!appt) return Response.json({ error: "Termin nicht gefunden" }, { status: 404, headers: corsHeaders });

    const to = (body?.to || appt.contact_email || "").trim();
    if (!to.includes("@")) return Response.json({ error: "Keine gültige Kunden-E-Mail hinterlegt" }, { status: 400, headers: corsHeaders });

    // Alte Token entwerten, neuen erzeugen
    await sb.from("delivery_confirmation_tokens").update({ revoked: true }).eq("appointment_id", appointmentId).is("used_at", null);
    const raw = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + validDays * 86400_000).toISOString();
    await sb.from("delivery_confirmation_tokens").insert({
      appointment_id: appointmentId,
      token_hash: await sha256(raw),
      expires_at: expiresAt,
    });

    const link = `${baseUrl}/liefertermin/${raw}`;
    const address = [appt.delivery_street, `${appt.delivery_zip ?? ""} ${appt.delivery_city ?? ""}`.trim(), appt.delivery_country].filter(Boolean).join(", ");

    const customerHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
        <p>Guten Tag ${esc(appt.contact_name || appt.customer_name || "")},</p>
        <p>wir möchten Ihnen Ihr Gerät ausliefern und schlagen folgenden Termin vor:</p>
        <table style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 12px 4px 0"><b>Datum</b></td><td>${esc(fmtDate(appt.planned_date))}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Zeitfenster</b></td><td>${esc(fmtWindow(appt))}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Adresse</b></td><td>${esc(address)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Gerät</b></td><td>${esc(appt.device_name || appt.article_name || "-")}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Auftrag</b></td><td>${esc(appt.order_number || "-")}</td></tr>
        </table>
        <p style="margin:20px 0">
          <a href="${esc(link)}" style="background:#C9A227;color:#111;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Termin jetzt bestätigen</a>
        </p>
        <p style="font-size:12px;color:#555">Über den Link können Sie den Termin auch ablehnen, einen Alternativtermin vorschlagen oder einen Rückruf anfordern. Der Link ist bis zum ${esc(fmtDate(expiresAt.slice(0, 10)))} gültig.</p>
        <p>Freundliche Grüße<br/>Ihr Alix Auslieferungsteam</p>
      </div>`;

    await sendMail(sb, { appointment_id: appointmentId, kind: "confirmation_request" }, {
      to: [to],
      subject: `Ihr Liefertermin ${appt.order_number ? `zum Auftrag ${appt.order_number}` : ""} – bitte bestätigen`.replace(/\s+/g, " "),
      html: customerHtml,
    });

    // Interne Information (Verkäufer / Operations)
    const internalTo: string[] = Array.isArray(body?.internalRecipients) ? body.internalRecipients.filter((x: string) => x?.includes("@")) : [];
    if (internalTo.length) {
      await sendMail(sb, { appointment_id: appointmentId, kind: "confirmation_request_internal" }, {
        to: internalTo,
        subject: `Terminanfrage versendet – ${appt.customer_name ?? ""} (${appt.order_number ?? "-"})`,
        html: `<div style="font-family:Arial;font-size:14px">Terminanfrage für <b>${esc(appt.customer_name)}</b>, Auftrag ${esc(appt.order_number)} am ${esc(fmtDate(appt.planned_date))} (${esc(fmtWindow(appt))}) wurde an ${esc(to)} versendet.</div>`,
      });
    }

    // Status + Historie
    await sb.from("delivery_appointments").update({ status: "bestaetigung_versendet" }).eq("id", appointmentId);
    await sb.from("delivery_status_history").insert({
      appointment_id: appointmentId,
      from_status: appt.status,
      to_status: "bestaetigung_versendet",
      source: "delivery-appointment-send",
      note: `Bestätigungslink an ${to}`,
    }).then(() => {}, () => {});

    // Teamkalender-Sync: gelber, vorläufiger Eintrag
    const startAt = appt.planned_date ? new Date(`${appt.planned_date}T${(appt.time_window_start || "08:00").slice(0, 5)}:00`) : null;
    if (startAt) {
      const endAt = new Date(startAt.getTime() + (appt.duration_minutes || 90) * 60000);
      const payload = {
        title: `Auslieferung (vorläufig): ${appt.customer_name ?? ""} – ${appt.order_number ?? ""}`,
        description: [
          `Kunde: ${appt.customer_name ?? "-"}`,
          `Auftrag: ${appt.order_number ?? "-"}`,
          `Gerät: ${appt.device_name ?? appt.article_name ?? "-"}`,
          `Telefon: ${appt.contact_phone ?? appt.contact_mobile ?? "-"}`,
          `Zeitfenster: ${fmtWindow(appt)}`,
        ].join("\n"),
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        address,
        location: `${appt.delivery_zip ?? ""} ${appt.delivery_city ?? ""}`.trim(),
        customer_id: appt.customer_id,
        customer_name: appt.customer_name,
        customer_email: to,
        customer_phone: appt.contact_phone ?? appt.contact_mobile,
        requires_confirmation: true,
        confirmation_status: "pending",
        event_kind: "delivery",
        source: "dispatch",
      };
      if (appt.esc_event_id) {
        await sb.from("esc_events").update(payload).eq("id", appt.esc_event_id).then(() => {}, () => {});
      } else {
        const { data: ev } = await sb.from("esc_events").insert(payload).select("id").maybeSingle();
        if (ev?.id) await sb.from("delivery_appointments").update({ esc_event_id: ev.id }).eq("id", appointmentId);
      }
    }

    return Response.json({ ok: true, link, expires_at: expiresAt }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: String((e as Error).message ?? e) }, { status: 500, headers: corsHeaders });
  }
});
