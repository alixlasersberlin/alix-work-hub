// Sendet die Terminbestätigungs-E-Mail an den Kunden.
// Kopie (CC) immer an support@alix-lasers.com.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const COPY_TO = "support@alix-lasers.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

function fmt(iso?: string) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Europe/Berlin",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!SUPABASE_URL || !ANON || !SERVICE_ROLE) return json({ error: "Supabase-Konfiguration fehlt" }, 500);
    if (!RESEND_API_KEY || !LOVABLE_API_KEY) return json({ error: "E-Mail-Konfiguration fehlt" }, 500);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(auth.replace("Bearer ", ""));
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const {
      appointment_id = null,
      recipient_email,
      customer_name = "",
      title = "Termin",
      description = "",
      start_at,
      end_at,
      location = "",
      address = "",
    } = body ?? {};

    if (!recipient_email) return json({ error: "recipient_email fehlt" }, 400);
    const normalizedRecipient = String(recipient_email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedRecipient)) {
      return json({ error: "Ungültige Empfänger-E-Mail" }, 400);
    }

    const subject = `Terminbestätigung: ${title} am ${fmt(start_at).split(" um ")[0]}`;
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111;padding:24px">
      <h2 style="color:#0f172a;margin:0 0 12px">Ihre Terminbestätigung</h2>
      <p>Hallo ${esc(customer_name)},</p>
      <p>wir bestätigen Ihnen folgenden Termin:</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 12px 4px 0"><b>Termin</b></td><td>${esc(title)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><b>Beginn</b></td><td>${esc(fmt(start_at))}</td></tr>
        ${end_at ? `<tr><td style="padding:4px 12px 4px 0"><b>Ende</b></td><td>${esc(fmt(end_at))}</td></tr>` : ""}
        ${location ? `<tr><td style="padding:4px 12px 4px 0"><b>Ort</b></td><td>${esc(location)}</td></tr>` : ""}
        ${address ? `<tr><td style="padding:4px 12px 4px 0"><b>Adresse</b></td><td>${esc(address)}</td></tr>` : ""}
      </table>
      ${description ? `<p style="margin-top:16px">${esc(description)}</p>` : ""}
      <p style="margin-top:20px">Bitte antworten Sie kurz auf diese E-Mail, falls der Termin nicht passt.</p>
      <p style="color:#64748b;font-size:12px;margin-top:24px">Alix Lasers ® · alixwork.de</p>
    </body></html>`;

    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Alix Lasers ® <noreply@notify.alixlasers.ai>",
        to: [normalizedRecipient],
        cc: [COPY_TO],
        reply_to: COPY_TO,
        subject,
        html,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`Resend failed [${res.status}]: ${text}`);
      return json({ ok: false, status: res.status, error: text }, res.status);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    await admin.from("esc_message_log").insert({
      event_id: appointment_id,
      channel: "email",
       recipient: normalizedRecipient,
      subject,
      body: html,
      template_key: "appointment-confirmation",
      status: "sent",
    }).then(() => {}, () => {});

    console.log(`Appointment confirmation sent: ${appointment_id ?? "new"} -> ${normalizedRecipient}; cc=${COPY_TO}`);
    return json({ ok: true, cc: COPY_TO });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
