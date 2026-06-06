// Twilio WhatsApp inbound webhook (application/x-www-form-urlencoded)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

function twiml(body = "<Response></Response>", status = 200) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/^whatsapp:/i, "").trim();
}

function detectRef(text: string): { serial?: string; order?: string } {
  const out: { serial?: string; order?: string } = {};
  const sn = text.match(/\b(SN|S\/N|Seriennummer)[\s:#-]*([A-Z0-9\-]{4,})\b/i);
  if (sn) out.serial = sn[2];
  const on = text.match(/\b(Auftrag|Order|Bestell(?:ung)?(?:\s*Nr\.?)?|AU|OR)[\s:#-]*([A-Z0-9\-]{3,})\b/i);
  if (on) out.order = on[2];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // Twilio uses GET for some health checks; just acknowledge.
  if (req.method === "GET") return new Response("ok", { headers: corsHeaders });

  try {
    const ctype = req.headers.get("content-type") ?? "";
    let params: URLSearchParams;
    if (ctype.includes("application/x-www-form-urlencoded")) {
      params = new URLSearchParams(await req.text());
    } else if (ctype.includes("application/json")) {
      const j = await req.json();
      params = new URLSearchParams(Object.entries(j).map(([k, v]) => [k, String(v)]));
    } else {
      params = new URLSearchParams(await req.text());
    }

    const messageSid = params.get("MessageSid") ?? params.get("SmsMessageSid") ?? "";
    const fromRaw = params.get("From") ?? "";
    const toRaw = params.get("To") ?? "";
    const body = params.get("Body") ?? "";
    const numMedia = parseInt(params.get("NumMedia") ?? "0", 10) || 0;
    const profileName = params.get("ProfileName") ?? null;

    const customerPhone = normalizePhone(fromRaw);
    const receiverPhone = normalizePhone(toRaw);

    if (!customerPhone) {
      await supabase.from("whatsapp_sync_logs").insert({
        event_type: "inbound_invalid",
        status: "error",
        error_message: "Missing From",
        payload: Object.fromEntries(params),
      });
      return twiml();
    }

    // Collect media
    const media: { url: string; type: string }[] = [];
    for (let i = 0; i < numMedia; i++) {
      const url = params.get(`MediaUrl${i}`);
      const type = params.get(`MediaContentType${i}`) ?? "application/octet-stream";
      if (url) media.push({ url, type });
    }
    const firstMedia = media[0];

    // Find or create conversation
    let { data: conv } = await supabase
      .from("whatsapp_sc_conversations")
      .select("*")
      .eq("customer_phone", customerPhone)
      .maybeSingle();

    if (!conv) {
      const { data: created, error: convErr } = await supabase
        .from("whatsapp_sc_conversations")
        .insert({
          customer_phone: customerPhone,
          customer_name: profileName,
          status: "open",
          assigned_department: "service",
          unread_count: 1,
          last_message_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (convErr) throw convErr;
      conv = created;
    } else {
      await supabase
        .from("whatsapp_sc_conversations")
        .update({
          customer_name: conv.customer_name ?? profileName,
          unread_count: (conv.unread_count ?? 0) + 1,
          last_message_at: new Date().toISOString(),
          status: conv.status === "archived" ? "open" : conv.status,
        })
        .eq("id", conv.id);
    }

    // Try to match a customer if not linked
    if (!conv.linked_customer_id) {
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", customerPhone)
        .maybeSingle();
      if (cust) {
        await supabase
          .from("whatsapp_sc_conversations")
          .update({ linked_customer_id: cust.id })
          .eq("id", conv.id);
        conv.linked_customer_id = cust.id;
      }
    }

    // Find/Create ticket
    let ticketId = conv.linked_ticket_id as string | null;
    if (ticketId) {
      const { data: t } = await supabase
        .from("tickets")
        .select("id,status")
        .eq("id", ticketId)
        .maybeSingle();
      if (!t || ["geschlossen", "closed", "Erledigt", "erledigt"].includes(String(t?.status ?? ""))) {
        ticketId = null;
      }
    }

    if (!ticketId) {
      const refs = detectRef(body);
      const { data: newTicket, error: tErr } = await supabase
        .from("tickets")
        .insert({
          title: `WhatsApp: ${conv.customer_name ?? customerPhone}`,
          description: body || "(WhatsApp Nachricht ohne Text)",
          status: "Neu",
          priority: "Normal",
          department: conv.assigned_department ?? "service",
          source_system: "twilio_whatsapp",
          customer_phone: customerPhone,
          customer_name: conv.customer_name,
          serial_number: refs.serial ?? null,
          order_number: refs.order ?? null,
        })
        .select("id")
        .single();
      if (tErr) throw tErr;
      ticketId = newTicket.id;
      await supabase
        .from("whatsapp_sc_conversations")
        .update({ linked_ticket_id: ticketId })
        .eq("id", conv.id);
    }

    // Store WhatsApp message
    const { data: storedMsg } = await supabase
      .from("whatsapp_sc_messages")
      .insert({
        conversation_id: conv.id,
        ticket_id: ticketId,
        direction: "in",
        sender_name: profileName,
        sender_phone: customerPhone,
        receiver_phone: receiverPhone,
        message_text: body || null,
        media_url: firstMedia?.url ?? null,
        media_type: firstMedia?.type ?? null,
        whatsapp_message_id: messageSid,
        twilio_message_sid: messageSid,
        status: "received",
      })
      .select("id")
      .single();

    // Mirror to ticket_messages
    if (ticketId) {
      await supabase.from("ticket_messages").insert({
        ticket_id: ticketId,
        external_message_id: messageSid,
        sender_type: "customer",
        sender_name: profileName ?? customerPhone,
        message: body || (firstMedia ? `[${firstMedia.type}]` : "(leer)"),
        is_internal: false,
        source_system: "twilio_whatsapp",
      });

      for (const m of media) {
        await supabase.from("ticket_attachments").insert({
          ticket_id: ticketId,
          file_url: m.url,
          file_name: m.url.split("/").pop() ?? "anhang",
          file_type: m.type,
          source_system: "twilio_whatsapp",
        });
      }
    }

    await supabase.from("whatsapp_sync_logs").insert({
      event_type: "inbound",
      status: "success",
      conversation_id: conv.id,
      ticket_id: ticketId,
      message_id: storedMsg?.id ?? null,
      payload: { messageSid, from: fromRaw, to: toRaw, numMedia },
    });

    return twiml();
  } catch (err) {
    console.error("twilio webhook error", err);
    try {
      await supabase.from("whatsapp_sync_logs").insert({
        event_type: "inbound_error",
        status: "error",
        error_message: String(err?.message ?? err),
      });
    } catch (_) { /* ignore */ }
    // Always return 200 to Twilio so it doesn't retry forever
    return twiml();
  }
});
