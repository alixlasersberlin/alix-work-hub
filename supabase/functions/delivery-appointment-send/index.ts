import "../_shared/global-bcc.ts";
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

const MAIL_FROM = "Alix Lasers ® <no-reply@alixwork.de>";

async function sendMail(
  sb: any,
  log: Record<string, unknown>,
  opts: { to: string[]; subject: string; html: string; bcc?: string[] },
) {
  const bcc = opts.bcc ?? BCC;
  if (!RESEND_API_KEY || opts.to.length === 0) {
    return { status: "skipped", error: RESEND_API_KEY ? "Kein Empfänger" : "RESEND_API_KEY fehlt", providerId: null, from: MAIL_FROM, bcc };
  }
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
        from: "Alix Lasers ® <noreply@alixlasers.ai>",
        to: opts.to,
        bcc: [...bcc, "service@alix-lasers.com"],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) { status = "failed"; error = out?.message || out?.error || `HTTP ${res.status}`; }
    providerId = out?.id ?? null;
  } catch (e) {
    status = "failed";
    error = String((e as Error).message ?? e);
  }
  await sb.from("delivery_email_logs").insert({
    ...log,
    recipient: opts.to.join(", "),
    bcc: bcc.join(", "),
    subject: opts.subject,
    status,
    provider_id: providerId,
    error,
    sent_at: new Date().toISOString(),
  }).then(() => {}, () => {});
  return { status, error, providerId, from: MAIL_FROM, bcc };
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
    const testMode: boolean = body?.testMode === true;
    let baseUrl: string = (body?.baseUrl || "https://app.alixwork.de").replace(/\/+$/, "");
    // Never expose Lovable infrastructure domains in customer emails
    if (/lovable|supabase/i.test(baseUrl)) baseUrl = "https://app.alixwork.de";
    const validDays: number = Number(body?.validDays ?? 14);
    if (!appointmentId) return Response.json({ error: "appointmentId erforderlich" }, { status: 400, headers: corsHeaders });

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: appt } = await sb.from("delivery_appointments").select("*").eq("id", appointmentId).maybeSingle();
    if (!appt) return Response.json({ error: "Termin nicht gefunden" }, { status: 404, headers: corsHeaders });

    const to = String(testMode ? (body?.testTo || u.user.email || "") : (body?.to || appt.contact_email || "")).trim();
    if (!to.includes("@")) {
      return Response.json(
        { error: testMode ? "Keine gültige Test-E-Mail angegeben" : "Keine gültige Kunden-E-Mail hinterlegt" },
        { status: 400, headers: corsHeaders },
      );
    }

    let raw = "TESTLINK-" + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + validDays * 86400_000).toISOString();

    if (!testMode) {
      // Alte Token entwerten, neuen erzeugen
      await sb.from("delivery_confirmation_tokens").update({ revoked: true }).eq("appointment_id", appointmentId).is("used_at", null);
      raw = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      await sb.from("delivery_confirmation_tokens").insert({
        appointment_id: appointmentId,
        token_hash: await sha256(raw),
        expires_at: expiresAt,
      });
    }


    const link = `${baseUrl}/liefertermin/${raw}`;
    const address = [appt.delivery_street, `${appt.delivery_zip ?? ""} ${appt.delivery_city ?? ""}`.trim(), appt.delivery_country].filter(Boolean).join(", ");

    // Alle zugehörigen Daten laden: Positionen + Tour
    const { data: items } = await sb
      .from("delivery_loading_items")
      .select("description, quantity, serial_number, item_type, position")
      .eq("appointment_id", appointmentId)
      .order("position", { ascending: true });

    const { data: stop } = await sb
      .from("delivery_tour_stops")
      .select("tour_id, position")
      .eq("appointment_id", appointmentId)
      .maybeSingle();
    let tour: any = null;
    if (stop?.tour_id) {
      const { data: t } = await sb
        .from("delivery_tours")
        .select("tour_number, title, tour_date, planned_start_time, region")
        .eq("id", stop.tour_id)
        .maybeSingle();
      tour = t;
    }

    const rows: Array<[string, string]> = [
      ["Auftrag", appt.order_number || "-"],
      ["Kunde", [appt.company_name, appt.customer_name].filter(Boolean).join(" · ") || "-"],
      ["Ansprechpartner", appt.contact_name || "-"],
      ["Telefon", appt.contact_phone || appt.contact_mobile || "-"],
      ["E-Mail", to],
      ["Terminart", String(appt.appointment_type || "auslieferung").replace(/_/g, " ")],
      ["Datum", fmtDate(appt.planned_date || tour?.tour_date)],
      ["Zeitfenster", fmtWindow(appt)],
      ["Voraussichtliche Dauer", appt.duration_minutes ? `${appt.duration_minutes} Minuten` : "-"],
      ["Lieferadresse", address || "-"],
      ["Etage / Zugang", [appt.floor, appt.access_notes].filter(Boolean).join(" · ") || "-"],
      ["Gerät", appt.device_name || appt.article_name || "-"],
      ["Seriennummer", appt.serial_number || "-"],
      ["Lieferumfang", appt.scope_of_delivery || "-"],
      ["Tour", tour ? [tour.tour_number, tour.title].filter(Boolean).join(" · ") : "-"],
      ["Hinweise", appt.customer_notes || appt.notes || "-"],
    ];

    const infoRows = rows
      .filter(([label, value]) => value && (value !== "-" || ["Datum", "Zeitfenster", "Lieferadresse", "Auftrag"].includes(label)))
      .map(([label, value]) => `<tr><td style="padding:5px 14px 5px 0;vertical-align:top;white-space:nowrap"><b>${esc(label)}</b></td><td style="padding:5px 0">${esc(value)}</td></tr>`)
      .join("");

    const itemRows = (items ?? [])
      .map((i: any) => `<tr><td style="padding:4px 14px 4px 0">${esc(i.quantity ?? 1)}×</td><td style="padding:4px 14px 4px 0">${esc(i.description)}</td><td style="padding:4px 0;color:#555">${esc(i.serial_number || "")}</td></tr>`)
      .join("");

    const customerHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
        <p>Guten Tag ${esc(appt.contact_name || appt.customer_name || "")},</p>
        <p>wir möchten Ihnen Ihre Lieferung zustellen und schlagen folgenden Termin vor:</p>
        <table style="border-collapse:collapse;font-size:14px">${infoRows}</table>
        ${itemRows ? `<h3 style="font-size:14px;margin:20px 0 6px">Lieferpositionen</h3><table style="border-collapse:collapse;font-size:14px">${itemRows}</table>` : ""}
        <p style="margin:20px 0">
          <a href="${esc(link)}" style="background:#C9A227;color:#111;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Termin jetzt bestätigen</a>
        </p>
        <p style="font-size:12px;color:#555">Über den Link können Sie den Termin auch ablehnen, einen Alternativtermin vorschlagen oder einen Rückruf anfordern. Der Link ist bis zum ${esc(fmtDate(expiresAt.slice(0, 10)))} gültig.</p>
        <p>Freundliche Grüße<br/>Ihr Alix Auslieferungsteam</p>
      </div>`;

    const testBanner = testMode
      ? `<div style="font-family:Arial;font-size:13px;background:#FFF4CC;border:1px solid #C9A227;padding:10px 14px;border-radius:6px;margin-bottom:16px">
           <b>TESTMAIL</b> – interne Vorschau mit echten Termindaten. Der Bestätigungslink ist bewusst ungültig, der Kunde wurde nicht benachrichtigt.
         </div>`
      : "";

    const mailResult = await sendMail(sb, { appointment_id: appointmentId, kind: testMode ? "confirmation_request_test" : "confirmation_request" }, {
      to: [to],
      bcc: testMode ? [] : undefined,
      subject: `${testMode ? "[TEST] " : ""}Ihr Liefertermin ${appt.order_number ? `zum Auftrag ${appt.order_number}` : ""} – bitte bestätigen`.replace(/\s+/g, " "),
      html: testBanner + customerHtml,
    });

    if (testMode) {
      return Response.json(
        {
          ok: mailResult.status === "sent",
          test: true,
          to,
          from: "Alix Lasers ® <noreply@alixlasers.ai>",
          bcc: ["service@alix-lasers.com"],
          status: mailResult.status,
          error: mailResult.error,
          provider_id: mailResult.providerId,
          subject: `[TEST] Ihr Liefertermin ${appt.order_number ? `zum Auftrag ${appt.order_number}` : ""} – bitte bestätigen`.replace(/\s+/g, " "),
        },
        { headers: corsHeaders },
      );
    }

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