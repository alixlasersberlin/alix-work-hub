// ac-missed-call-sms
// Sendet eine SMS an eingehende Anrufer, deren Anruf verpasst wurde.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENV_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const ENV_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const ENV_FROM = Deno.env.get("TWILIO_SMS_FROM_NUMBER") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function normalizeE164(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+49" + s.slice(1);
  if (!s.startsWith("+")) s = "+" + s;
  return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function loadTwilio() {
  const { data } = await admin
    .from("sms_settings")
    .select("account_sid, auth_token, from_number")
    .eq("id", true)
    .maybeSingle();
  return {
    sid: data?.account_sid?.trim() || ENV_SID,
    token: data?.auth_token?.trim() || ENV_TOKEN,
    from: data?.from_number?.trim() || ENV_FROM,
  };
}

async function isInBusinessHours(): Promise<boolean> {
  const now = new Date();
  const dow = ((now.getUTCDay() + 6) % 7) + 1; // 1=Mon..7=Sun
  const { data } = await admin
    .from("ac_pbx_business_hours")
    .select("day_of_week, open_time, close_time, is_open")
    .eq("day_of_week", dow)
    .maybeSingle();
  if (!data || !data.is_open) return false;
  const hhmm = now.toISOString().substring(11, 16);
  return hhmm >= (data.open_time ?? "00:00") && hhmm <= (data.close_time ?? "23:59");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const callId = body?.call_id;
    if (!callId) return json({ error: "call_id required" }, 400);

    const { data: call, error: callErr } = await admin
      .from("ac_calls")
      .select("*")
      .eq("id", callId)
      .maybeSingle();
    if (callErr || !call) return json({ error: "call not found" }, 404);

    if (call.status !== "missed" || call.direction !== "inbound") {
      return json({ skipped: "not a missed inbound call" });
    }
    if (call.missed_sms_sent_at) {
      return json({ skipped: "already sent" });
    }

    // Load PBX settings (any row – global config)
    const { data: settings } = await admin
      .from("ac_pbx_settings")
      .select("missed_call_sms_enabled, missed_call_sms_template, missed_call_sms_business_hours_only, missed_call_sms_cooldown_minutes")
      .limit(1)
      .maybeSingle();

    if (!settings?.missed_call_sms_enabled) {
      return json({ skipped: "disabled in settings" });
    }

    if (settings.missed_call_sms_business_hours_only && !(await isInBusinessHours())) {
      return json({ skipped: "outside business hours" });
    }

    const to = normalizeE164(call.from_number || "");
    if (!to) return json({ error: "invalid from_number" }, 400);

    // Cooldown: check if we sent an SMS to this number recently
    const cooldown = settings.missed_call_sms_cooldown_minutes ?? 60;
    if (cooldown > 0) {
      const since = new Date(Date.now() - cooldown * 60_000).toISOString();
      const { data: recent } = await admin
        .from("ac_calls")
        .select("id")
        .eq("from_number", call.from_number)
        .not("missed_sms_sent_at", "is", null)
        .gte("missed_sms_sent_at", since)
        .limit(1);
      if (recent && recent.length > 0) {
        return json({ skipped: "cooldown" });
      }
    }

    const tw = await loadTwilio();
    if (!tw.sid || !tw.token || !tw.from) {
      return json({ error: "twilio not configured" }, 500);
    }

    const message = settings.missed_call_sms_template ||
      "Hallo, wir haben Ihren Anruf leider verpasst und melden uns umgehend zurück.";

    const twUrl = `https://api.twilio.com/2010-04-01/Accounts/${tw.sid}/Messages.json`;
    const form = new URLSearchParams({ To: to, From: tw.from, Body: message });
    const twResp = await fetch(twUrl, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${tw.sid}:${tw.token}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const twData = await twResp.json().catch(() => ({}));

    if (!twResp.ok) {
      await admin.from("customer_sms_logs").insert({
        phone: to,
        message_text: message,
        status: "failed",
        error_message: JSON.stringify(twData),
        document_type: "missed_call",
      });
      return json({ error: "twilio failed", details: twData }, 502);
    }

    await admin.from("customer_sms_logs").insert({
      phone: to,
      message_text: message,
      status: "sent",
      twilio_sid: twData.sid,
      document_type: "missed_call",
      sent_at: new Date().toISOString(),
    });

    await admin
      .from("ac_calls")
      .update({ missed_sms_sent_at: new Date().toISOString() })
      .eq("id", callId);

    return json({ ok: true, sid: twData.sid });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
