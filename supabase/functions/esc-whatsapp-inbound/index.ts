// Twilio WhatsApp inbound webhook for ESC: mark event confirmed on "JA"/"YES"
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function twiml(body = "<Response></Response>") {
  return new Response(body, { headers: { ...cors, "Content-Type": "text/xml" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return new Response("ok", { headers: cors });
  try {
    const params = new URLSearchParams(await req.text());
    const from = (params.get("From") ?? "").replace(/^whatsapp:/i, "");
    const body = (params.get("Body") ?? "").trim().toLowerCase();

    // Log inbound
    await admin.from("esc_message_log").insert({
      channel: "whatsapp", recipient: from, body,
      status: "received",
    });

    // Confirmation keywords
    const yes = ["ja", "yes", "ok", "bestätigt", "bestaetigt", "1"];
    const no = ["nein", "no", "absagen", "2"];

    if (yes.includes(body) || no.includes(body)) {
      // Match to latest event via participant phone
      const { data: part } = await admin
        .from("esc_event_participants")
        .select("event_id, id")
        .eq("phone", from)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (part?.event_id) {
        await admin.from("esc_events").update({
          status: yes.includes(body) ? "bestaetigt" : "abgelehnt",
        }).eq("id", part.event_id);
        await admin.from("esc_audit_log").insert({
          event_id: part.event_id,
          action: "WHATSAPP_REPLY",
          details: { from, body },
        });
      }
    }
    return twiml();
  } catch (e) {
    console.error("esc-whatsapp-inbound", e);
    return twiml();
  }
});
