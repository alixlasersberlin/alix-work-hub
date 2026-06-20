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

const SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const SMS_FROM = Deno.env.get("TWILIO_SMS_FROM_NUMBER") ?? "";
const WA_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM_NUMBER") ?? "";
const FROM = SMS_FROM || WA_FROM.replace(/^whatsapp:/i, "");

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

    const status = {
      account_sid_set: !!SID,
      account_sid_masked: mask(SID),
      auth_token_set: !!TOKEN,
      sms_from_set: !!SMS_FROM,
      whatsapp_from_set: !!WA_FROM,
      effective_from: FROM || null,
    };

    if (action === "status") return json({ ok: true, status });

    if (action === "test") {
      const to = normE164(String(body?.phone ?? ""));
      const text = String(body?.text ?? "Test-SMS von Alix Lasers (Konfiguration).");
      if (!to) return json({ error: "Ungültige Mobilnummer" }, 400);
      if (!SID || !TOKEN || !FROM) return json({ error: "Twilio Secrets fehlen", status }, 500);
      const url = `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`;
      const auth = btoa(`${SID}:${TOKEN}`);
      const form = new URLSearchParams({ To: to, From: FROM, Body: text });
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) return json({ ok: false, error: `Twilio ${res.status}: ${data?.message ?? ""}`, twilio: data, status }, 502);
      return json({ ok: true, sid: data?.sid, status: data?.status, twilio_from: FROM });
    }

    return json({ error: "Unbekannte Aktion" }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? "Fehler" }, 500);
  }
});
