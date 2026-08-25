// Sendet einen 6-stelligen SMS-Code für die Zwei-Faktor-Verifizierung (Super Admin).
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

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadTwilioConfig() {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    // SMS-Zweitfaktor steht jedem authentifizierten Nutzer für das
    // eigene Konto zur Verfügung – keine zusätzliche Rollenprüfung.



    const body = await req.json().catch(() => ({}));
    const purpose = body?.purpose === "enroll" ? "enroll" : "login";

    const { data: factor } = await admin
      .from("mfa_sms_factors")
      .select("phone, enabled, verified_at")
      .eq("user_id", user.id)
      .maybeSingle();

    let phone: string | null;
    if (purpose === "enroll") {
      phone = normalizeE164(String(body?.phone ?? ""));
      if (!phone) return json({ error: "invalid_phone" }, 400);
    } else {
      if (!factor?.enabled || !factor?.verified_at) return json({ error: "sms_not_enabled" }, 400);
      phone = factor.phone;
    }

    // Rate limit: max. 1 Code / 60 s, max. 6 Codes / Stunde
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { data: recent } = await admin
      .from("mfa_sms_codes")
      .select("created_at")
      .eq("user_id", user.id)
      .gte("created_at", hourAgo)
      .order("created_at", { ascending: false });
    if ((recent?.length ?? 0) >= 6) return json({ error: "rate_limited" }, 429);
    if (recent?.[0] && Date.now() - new Date(recent[0].created_at).getTime() < 60_000) {
      return json({ error: "cooldown" }, 429);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256(`${user.id}:${code}`);

    await admin
      .from("mfa_sms_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("consumed_at", null);

    const { error: insErr } = await admin.from("mfa_sms_codes").insert({
      user_id: user.id,
      purpose,
      phone,
      code_hash: codeHash,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    if (insErr) throw new Error(insErr.message);

    if (purpose === "enroll") {
      await admin.from("mfa_sms_factors").upsert(
        { user_id: user.id, phone, enabled: false, verified_at: null },
        { onConflict: "user_id" },
      );
    }

    const cfg = await loadTwilioConfig();
    if (!cfg.sid || !cfg.token || !cfg.from) return json({ error: "twilio_not_configured" }, 500);

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${cfg.sid}:${cfg.token}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: cfg.from,
        Body: `Alix Lasers: Ihr Bestätigungscode lautet ${code}. Gültig für 5 Minuten.`,
      }),
    });
    if (!res.ok) {
      const details = await res.text();
      console.error(`Twilio failed [${res.status}]: ${details}`);
      return json({ error: "sms_failed", status: res.status, details }, 502);
    }

    const masked = phone.replace(/.(?=.{3})/g, "•");
    return json({ ok: true, phone_masked: masked });
  } catch (e) {
    console.error("mfa-sms-send error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
