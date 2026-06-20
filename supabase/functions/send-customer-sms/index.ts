// Sendet eine SMS mit signiertem PDF-Link an einen Kunden via Twilio Programmable Messaging.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const ENV_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const ENV_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const ENV_SMS_FROM = Deno.env.get("TWILIO_SMS_FROM_NUMBER") ?? "";
const ENV_WA_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM_NUMBER") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function loadTwilioConfig() {
  const { data } = await admin.from("sms_settings").select("account_sid, auth_token, from_number").eq("id", true).maybeSingle();
  return {
    sid: (data?.account_sid?.trim()) || ENV_SID,
    token: (data?.auth_token?.trim()) || ENV_TOKEN,
    from: (data?.from_number?.trim()) || ENV_SMS_FROM || ENV_WA_FROM.replace(/^whatsapp:/i, ""),
  };
}

const ALLOWED_ROLES = new Set([
  "Super Admin",
  "Admin",
  "Vertrieb",
  "Kundenservice",
  "Finance",
  "Service",
  "Serviceleitung",
  "Reparaturannahme",
  "Technik",
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeE164(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+49" + s.slice(1);
  if (!s.startsWith("+")) s = "+" + s;
  return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
}

async function ensureDownloadToken(documentId: string): Promise<{ token: string; file_name: string } | null> {
  const { data: doc } = await admin
    .from("order_documents")
    .select("id, download_token, file_name")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return null;
  if (doc.download_token && doc.download_token.length >= 16) {
    return { token: doc.download_token, file_name: doc.file_name };
  }
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const { error } = await admin
    .from("order_documents")
    .update({ download_token: token })
    .eq("id", documentId);
  if (error) return null;
  return { token, file_name: doc.file_name };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    // Role check
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("roles!inner(name)")
      .eq("user_id", userId);
    const roleNames = (roleRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    if (!roleNames.some((n: string) => ALLOWED_ROLES.has(n))) {
      return json({ error: "Forbidden: missing role" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const {
      customer_id,
      order_id,
      document_id,
      document_type,
      document_number,
      recipient_name,
      phone,
      message_text,
      base_url,
    } = body ?? {};

    if (!customer_id || !document_id || !message_text || !phone) {
      return json({ error: "Pflichtfelder fehlen (customer_id, document_id, phone, message_text)." }, 400);
    }

    const to = normalizeE164(String(phone));
    if (!to) return json({ error: "Ungültige Mobilnummer (E.164 erforderlich, z. B. +49…)." }, 400);

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_SMS_FROM) {
      return json({ error: "Twilio Secrets fehlen (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_SMS_FROM_NUMBER)." }, 500);
    }

    // Build signed link
    const tk = await ensureDownloadToken(String(document_id));
    if (!tk) return json({ error: "PDF konnte nicht gefunden werden." }, 404);

    const origin = (base_url && String(base_url).startsWith("http")) ? String(base_url).replace(/\/$/, "") : "https://alixwork.de";
    const link = `${origin}/d/${tk.token}`;

    const finalText = String(message_text).replace(/\{\{link\}\}/g, link);
    if (finalText.length > 1500) return json({ error: "SMS-Text zu lang." }, 400);

    // Send via Twilio
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const form = new URLSearchParams({ To: to, From: TWILIO_SMS_FROM, Body: finalText });

    let twilioSid: string | null = null;
    let twilioStatus = "queued";
    let errorMessage: string | null = null;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        errorMessage = `Twilio ${res.status}: ${data?.message ?? JSON.stringify(data)}`;
        twilioStatus = "failed";
      } else {
        twilioSid = data?.sid ?? null;
        twilioStatus = data?.status ?? "sent";
      }
    } catch (e: any) {
      errorMessage = e?.message ?? "Twilio-Verbindung nicht verfügbar";
      twilioStatus = "failed";
    }

    // Log
    await admin.from("customer_sms_logs").insert({
      customer_id,
      order_id: order_id ?? null,
      document_id,
      document_type: document_type ?? null,
      document_number: document_number ?? null,
      recipient_name: recipient_name ?? null,
      phone: to,
      message_text: finalText,
      link_url: link,
      twilio_sid: twilioSid,
      status: twilioStatus,
      error_message: errorMessage,
      sent_by: userId,
    });

    if (errorMessage) return json({ ok: false, error: errorMessage }, 502);
    return json({ ok: true, sid: twilioSid, status: twilioStatus, link });
  } catch (e: any) {
    return json({ error: e?.message ?? "Unbekannter Fehler" }, 500);
  }
});
