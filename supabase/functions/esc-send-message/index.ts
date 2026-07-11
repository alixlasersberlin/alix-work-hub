// ESC unified message dispatcher: email | sms | whatsapp
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") ?? "";
const TWILIO_FROM_SMS = Deno.env.get("TWILIO_FROM_SMS") ?? "";
const TWILIO_FROM_WHATSAPP = Deno.env.get("TWILIO_FROM_WHATSAPP") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function sendEmail(recipient: string, subject: string, body: string) {
  const { data, error } = await admin.functions.invoke("esc-send-email", {
    body: { to: recipient, subject, html: body },
  });
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

async function sendTwilio(kind: "sms" | "whatsapp", to: string, text: string) {
  if (!LOVABLE_API_KEY || !TWILIO_API_KEY) throw new Error("Twilio connector not configured");
  const from = kind === "whatsapp" ? `whatsapp:${TWILIO_FROM_WHATSAPP}` : TWILIO_FROM_SMS;
  const toAddr = kind === "whatsapp" ? `whatsapp:${to}` : to;
  if (!from) throw new Error(`Missing TWILIO_FROM_${kind.toUpperCase()}`);
  const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: toAddr, From: from, Body: text }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? `Twilio ${res.status}`);
  return json?.sid ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { event_id, channel, recipient, subject, body, template_key } = await req.json();
    if (!channel || !recipient || !body) {
      return new Response(JSON.stringify({ error: "channel, recipient, body required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let providerId: string | null = null;
    let error: string | null = null;
    let status = "sent";
    try {
      if (channel === "email") providerId = await sendEmail(recipient, subject ?? "", body);
      else if (channel === "sms" || channel === "whatsapp") providerId = await sendTwilio(channel, recipient, body);
      else throw new Error(`Unknown channel: ${channel}`);
    } catch (e) {
      status = "error";
      error = String((e as Error).message ?? e);
    }

    await admin.from("esc_message_log").insert({
      event_id: event_id ?? null,
      channel, recipient, subject, body, template_key,
      status, provider_message_id: providerId, error,
    });

    if (status === "error") {
      return new Response(JSON.stringify({ ok: false, error }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, provider_message_id: providerId }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
