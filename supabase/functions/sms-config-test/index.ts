// Prüft Twilio-Konfiguration und sendet optional eine Test-SMS. Nur Admin/Super Admin.
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

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function mask(s: string) { return s ? `${s.slice(0, 4)}…${s.slice(-4)}` : ""; }
function normE164(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+49" + s.slice(1);
  if (!s.startsWith("+")) s = "+" + s;
  return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
}

async function loadEffective() {
  const { data } = await admin.from("sms_settings").select("account_sid, auth_token, from_number").eq("id", true).maybeSingle();
  const sid = (data?.account_sid?.trim()) || ENV_SID;
  const token = (data?.auth_token?.trim()) || ENV_TOKEN;
  const from = (data?.from_number?.trim()) || ENV_SMS_FROM || ENV_WA_FROM.replace(/^whatsapp:/i, "");
  return {
    sid, token, from,
    db_sid: !!data?.account_sid,
    db_token: !!data?.auth_token,
    db_from: !!data?.from_number,
  };
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
    const { data: claims, error: cerr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cerr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const uid = claims.claims.sub as string;

    const { data: roleRows } = await admin
      .from("user_roles").select("roles!inner(name)").eq("user_id", uid);
    const names = (roleRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    if (!names.some((n: string) => n === "Super Admin" || n === "Admin")) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? "status";

    const eff = await loadEffective();

    const status = {
      account_sid_set: !!eff.sid,
      account_sid_masked: mask(eff.sid),
      auth_token_set: !!eff.token,
      sms_from_set: !!(eff.db_from || ENV_SMS_FROM),
      whatsapp_from_set: !!ENV_WA_FROM,
      effective_from: eff.from || null,
      source: {
        account_sid: eff.db_sid ? "db" : (ENV_SID ? "env" : "missing"),
        auth_token: eff.db_token ? "db" : (ENV_TOKEN ? "env" : "missing"),
        from_number: eff.db_from ? "db" : (ENV_SMS_FROM ? "env (sms)" : (ENV_WA_FROM ? "env (whatsapp fallback)" : "missing")),
      },
    };

    if (action === "status") return json({ ok: true, status });

    if (action === "test") {
      const to = normE164(String(body?.phone ?? ""));
      const text = String(body?.text ?? "Test-SMS von Alix Lasers (Konfiguration).");
      if (!to) return json({ error: "Ungültige Mobilnummer" }, 400);
      if (!eff.sid || !eff.token || !eff.from) return json({ error: "Twilio-Zugangsdaten unvollständig", status }, 500);
      const url = `https://api.twilio.com/2010-04-01/Accounts/${eff.sid}/Messages.json`;
      const auth = btoa(`${eff.sid}:${eff.token}`);
      const form = new URLSearchParams({ To: to, From: eff.from, Body: text });
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) return json({ ok: false, error: `Twilio ${res.status}: ${data?.message ?? ""}`, twilio: data, status }, 502);
      return json({ ok: true, sid: data?.sid, status: data?.status, twilio_from: eff.from });
    }

    return json({ error: "Unbekannte Aktion" }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? "Fehler" }, 500);
  }
});
