// Sendet WhatsApp-Nachrichten via Twilio Programmable Messaging API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM_NUMBER") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(raw: string): string {
  return (raw ?? "").replace(/^whatsapp:/i, "").trim();
}

function ensureWhatsappPrefix(raw: string): string {
  const n = (raw ?? "").trim();
  if (!n) return "";
  return n.toLowerCase().startsWith("whatsapp:") ? n : `whatsapp:${n.startsWith("+") ? n : "+" + n}`;
}

async function twilioSend(to: string, body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    throw new Error("Twilio Secrets fehlen (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM_NUMBER).");
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const form = new URLSearchParams({
    To: ensureWhatsappPrefix(to),
    From: ensureWhatsappPrefix(TWILIO_FROM),
    Body: body,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Twilio ${res.status}: ${data?.message ?? JSON.stringify(data)}`);
  }
  return data as { sid: string; status: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "send";

    // Connection test
    if (action === "test_connection") {
      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        return json({ ok: false, error: "Secrets fehlen" }, 200);
      }
      const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}.json`;
      const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
      const r = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
      const j = await r.json();
      return json({
        ok: r.ok,
        status: r.status,
        account_status: j?.status ?? null,
        friendly_name: j?.friendly_name ?? null,
        from_number: TWILIO_FROM || null,
        error: r.ok ? null : (j?.message ?? "Verbindung fehlgeschlagen"),
      });
    }

    // Send via conversation, or via direct "to"
    let to: string | null = body.to ?? null;
    let conversationId: string | null = body.conversation_id ?? null;
    let ticketId: string | null = body.ticket_id ?? null;
    const text: string = String(body.message ?? body.text ?? "").trim();

    // Template support (backwards compatible with old whatsapp-send)
    let finalText = text;
    if (!finalText && body.template_key && conversationId) {
      const { data: tpl } = await admin
        .from("whatsapp_sc_templates")
        .select("body")
        .eq("key", body.template_key)
        .maybeSingle();
      if (tpl?.body) finalText = tpl.body;
    }

    if (conversationId) {
      const { data: conv, error: cErr } = await admin
        .from("whatsapp_sc_conversations")
        .select("*")
        .eq("id", conversationId)
        .maybeSingle();
      if (cErr || !conv) return json({ error: "Conversation nicht gefunden" }, 404);
      if (conv.opt_out) return json({ error: "Opt-out aktiv" }, 400);
      to = to ?? conv.customer_phone;
      ticketId = ticketId ?? conv.linked_ticket_id ?? null;
    }

    if (!to || !finalText) return json({ error: "to und message erforderlich" }, 400);

    // Send via Twilio
    let twilioSid: string | null = null;
    let sendStatus: "sent" | "error" = "sent";
    let errorMessage: string | null = null;
    try {
      const res = await twilioSend(to, finalText);
      twilioSid = res.sid;
    } catch (e) {
      sendStatus = "error";
      errorMessage = String(e?.message ?? e);
    }

    // Persist outbound message
    if (conversationId) {
      await admin.from("whatsapp_sc_messages").insert({
        conversation_id: conversationId,
        ticket_id: ticketId,
        direction: "out",
        sender_name: claims.claims.email ?? "Agent",
        sender_phone: normalizePhone(TWILIO_FROM),
        receiver_phone: normalizePhone(to),
        message_text: finalText,
        status: sendStatus,
        whatsapp_message_id: twilioSid,
        twilio_message_sid: twilioSid,
      });

      await admin
        .from("whatsapp_sc_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    // Mirror to ticket_messages (only successful sends, never internal)
    if (ticketId && sendStatus === "sent") {
      await admin.from("ticket_messages").insert({
        ticket_id: ticketId,
        external_message_id: twilioSid,
        sender_type: "agent",
        sender_name: claims.claims.email ?? "Agent",
        message: finalText,
        is_internal: false,
        source_system: "twilio_whatsapp",
      });
    }

    await admin.from("whatsapp_sync_logs").insert({
      event_type: "outbound",
      status: sendStatus,
      conversation_id: conversationId,
      ticket_id: ticketId,
      error_message: errorMessage,
      payload: { to, twilioSid },
    });

    if (sendStatus === "error") return json({ ok: false, error: errorMessage }, 502);
    return json({ ok: true, sid: twilioSid });
  } catch (err) {
    console.error("twilio-send error", err);
    return json({ error: String(err?.message ?? err) }, 500);
  }
});
