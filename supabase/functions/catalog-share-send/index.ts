import "../_shared/global-bcc.ts";
// Sendet Katalog-Share-Links per E-Mail, WhatsApp oder SMS.
// Nutzt vorhandene Kanäle: send-mail (Resend), Twilio WhatsApp, Twilio SMS.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { CatalogShareBody, CATALOG_SEND_ROLES, catalogShareOwned, approvedCatalogBase } from '../_shared/security-v42-mail.ts';
import { escapeMailText } from '../_shared/security-v42-input.ts';

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_WA_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM_NUMBER") ?? "";
const TWILIO_SMS_FROM = Deno.env.get("TWILIO_SMS_FROM_NUMBER") ?? "";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ensureWaPrefix(n: string) {
  const s = (n ?? "").trim();
  if (!s) return "";
  return s.toLowerCase().startsWith("whatsapp:") ? s : `whatsapp:${s.startsWith("+") ? s : "+" + s}`;
}

async function twilioSend(to: string, body: string, waMode: boolean) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio Secrets fehlen (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).");
  }
  const from = waMode ? TWILIO_WA_FROM : TWILIO_SMS_FROM;
  if (!from) throw new Error(`Twilio ${waMode ? "WhatsApp" : "SMS"} From-Number fehlt.`);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const form = new URLSearchParams({
    To: waMode ? ensureWaPrefix(to) : (to.startsWith("+") ? to : "+" + to.replace(/[^\d]/g, "")),
    From: waMode ? ensureWaPrefix(from) : from,
    Body: body,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${data?.message ?? JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const access = await requireCallerAccess(req, corsHeaders, CATALOG_SEND_ROLES);
    if ('response' in access) return access.response;
    const admin = access.caller;
    const authHeader = req.headers.get('Authorization') ?? '';
    const userId = access.user.id;
    const parsed = CatalogShareBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const body = parsed.data;
    const linkId = String(body.link_id ?? "").trim();
    const channel = String(body.channel ?? "").trim(); // 'email' | 'whatsapp' | 'sms'
    const fromEmail = String(body.from_email ?? "service@alix-lasers.com");
    const baseUrl = approvedCatalogBase(body.base_url);
    if (!baseUrl) return json({ error: 'Nicht freigegebene Katalog-Linkadresse' }, 400);
    const customSubject = body.subject ? String(body.subject) : null;
    const customBody = body.body ? String(body.body) : null;

    if (!linkId || !["email", "whatsapp", "sms"].includes(channel)) {
      return json({ error: "link_id und channel (email|whatsapp|sms) erforderlich" }, 400);
    }

    // Caller RLS and explicit ownership both apply; unrelated sales users cannot send this link.
    const { data: link, error: linkErr } = await admin
      .from("catalog_share_links")
      .select("id, created_by, token, item_id, recipient_name, recipient_email, recipient_phone, revoked_at, expires_at")
      .eq("id", linkId)
      .maybeSingle();
    if (linkErr || !link) return json({ error: "Link nicht gefunden" }, 404);
    if (!catalogShareOwned(userId, link.created_by, access.roles)) return json({ error: 'Forbidden' }, 403);
    if (link.revoked_at) return json({ error: "Link wurde widerrufen" }, 400);
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return json({ error: "Link ist abgelaufen" }, 400);
    }

    const { data: item } = await admin
      .from("catalog_items")
      .select("sku, name, source_system")
      .eq("id", link.item_id)
      .maybeSingle();
    if (!item) return json({ error: 'Artikel nicht zugänglich' }, 404);
    if (!item.source_system || !access.tenants.some((tenant: { zoho_source_system: string | null }) => tenant.zoho_source_system === item.source_system)) return json({ error: 'Forbidden' }, 403);

    const url = `${baseUrl}${link.token}`;
    const itemName = item?.name ?? "Katalog-Artikel";
    const greetName = link.recipient_name ? " " + link.recipient_name : "";
    const defaultSubject = `Artikelinformation: ${itemName}`;
    const defaultTextBody =
      `Guten Tag${greetName},\n\nanbei der Link zum Artikel ${itemName}${item?.sku ? " (" + item.sku + ")" : ""}:\n${url}\n\nMit freundlichen Grüßen\nAlixWork`;
    const shortText = `Artikel ${itemName}: ${url}`;

    let result: unknown = null;

    if (channel === "email") {
      if (!link.recipient_email) return json({ error: "Kein Empfänger-E-Mail hinterlegt" }, 400);
      const subject = customSubject ?? defaultSubject;
      const text = customBody ?? defaultTextBody;
      const html = `<p>${escapeMailText(text).replace(/\n/g, "<br>")}</p>`;
      const { data: sendData, error: sendErr } = await admin.functions.invoke("send-mail", {
        headers: { Authorization: authHeader },
        body: {
          to_email: link.recipient_email,
          to_name: link.recipient_name ?? undefined,
          from_email: fromEmail,
          subject,
          html_body: html,
          text_body: text,
        },
      });
      if (sendErr) throw new Error(sendErr.message ?? String(sendErr));
      result = sendData;
    } else if (channel === "whatsapp") {
      if (!link.recipient_phone) return json({ error: "Kein Empfänger-Telefon hinterlegt" }, 400);
      result = await twilioSend(link.recipient_phone, customBody ?? shortText, true);
    } else {
      if (!link.recipient_phone) return json({ error: "Kein Empfänger-Telefon hinterlegt" }, 400);
      result = await twilioSend(link.recipient_phone, customBody ?? shortText, false);
    }

    // Zusatzfelder pflegen (best effort)
    await admin
      .from("catalog_share_links")
      .update({ channel, last_sent_at: new Date().toISOString() })
      .eq("id", linkId);

    // Audit-Log in customer_communication_log (falls Empfänger bekannt)
    try {
      const preview = (customBody ?? (channel === "email" ? defaultTextBody : shortText)).slice(0, 500);
      await admin.from("customer_communication_log").insert({
        channel: channel === "email" ? "email" : channel,
        direction: "outbound",
        subject: customSubject ?? defaultSubject,
        preview,
        reference_table: "catalog_share_links",
        reference_id: linkId,
        metadata: { source: "catalog_share", link_id: linkId, item_id: link.item_id, url, recipient_email: link.recipient_email, recipient_phone: link.recipient_phone },
        created_by: userId,
      });
    } catch (_e) { /* ignore */ }

    return json({ ok: true, channel, result });
  } catch (e) {
    console.error("catalog-share-send error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
