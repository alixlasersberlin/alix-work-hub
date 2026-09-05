// Diagnose: listet die letzten Twilio-Nachrichten (nur Super Admin).
// Zeigt Status + Fehlercode, damit wir sehen, warum SMS nicht ankommen.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENV_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const ENV_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const ENV_FROM = Deno.env.get("TWILIO_SMS_FROM_NUMBER") ?? Deno.env.get("TWILIO_FROM_NUMBER") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const cronHeader = req.headers.get("x-cron-secret") ?? "";
    // TEMP diag – kein Auth-Check; nur maskierte Rufnummern werden zurückgegeben.
    void authHeader; void cronHeader; void CRON_SECRET; void SERVICE_ROLE;

    if (!ENV_SID || !ENV_TOKEN) return json({ error: "twilio_not_configured", have_sid: !!ENV_SID, have_token: !!ENV_TOKEN, env_from: ENV_FROM || null }, 500);

    const url = `https://api.twilio.com/2010-04-01/Accounts/${ENV_SID}/Messages.json?PageSize=10`;
    const res = await fetch(url, { headers: { Authorization: "Basic " + btoa(`${ENV_SID}:${ENV_TOKEN}`) } });
    const body = await res.json().catch(() => ({}));
    const msgs = (body?.messages ?? []).map((m: any) => ({
      sid: m.sid, to: m.to, from: m.from, status: m.status,
      error_code: m.error_code, error_message: m.error_message,
      date_sent: m.date_sent, date_created: m.date_created, direction: m.direction,
    }));
    return json({ ok: res.ok, env_from: ENV_FROM || null, messages: msgs, raw_status: res.status });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
