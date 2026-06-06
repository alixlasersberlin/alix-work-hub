// Alix MailCenter – Inbound mail webhook.
// DEAKTIVIERT: Wir empfangen keine E-Mails mehr im MailCenter.
// Alle eingehenden Antworten werden über das Reply-To-Mapping direkt an die
// externen Mailboxen weitergeleitet (siehe send-mail / send-campaign / run-automations).
// Dieser Endpoint nimmt Webhooks weiterhin entgegen (200 OK), verwirft sie aber.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Reply-To Mapping zur Dokumentation des Weiterleitungsziels
const FORWARD_MAP: Record<string, string> = {
  "finance@alixwork.de": "k.trinh@alix-operation.de",
  "vertrieb@alixwork.de": "rde@alix-lasers.com",
  "service@alixwork.de": "support@alix-lasers.com",
  "news@alixwork.de": "support@alix-operation.de",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({}));
    const data = (payload as any)?.data ?? payload;
    const toRaw = Array.isArray(data?.to)
      ? (data.to[0]?.email ?? data.to[0])
      : (data?.to?.email ?? data?.to ?? "");
    const forwardTo = FORWARD_MAP[String(toRaw).toLowerCase()] ?? null;

    console.log("inbound-mail: discarded", { to: toRaw, forwardTo });

    return new Response(
      JSON.stringify({ success: true, ignored: true, forwarded_to: forwardTo }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("inbound-mail discard error", err);
    return new Response(JSON.stringify({ success: true, ignored: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
