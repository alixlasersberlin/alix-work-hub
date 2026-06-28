// as-send-sms-reminder
// Sendet eine kurze After-Sales-SMS via Twilio + protokolliert die Aktion.
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

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Kind = "app" | "nisv" | "schulung" | "mediapaket" | "feedback" | "callback" | "generic";

const SMS_TEMPLATES: Record<Kind, string> = {
  app: "Hallo {{name}}, bitte installieren Sie die Alix Smart App, damit wir Sie optimal unterstützen können. Bei Fragen einfach antworten. Ihr Alix Team",
  nisv: "Hallo {{name}}, wir benötigen noch Ihren NiSV-Nachweis für den Betrieb Ihres Lasergerätes. Bitte melden Sie sich kurz bei uns. Ihr Alix Team",
  schulung: "Hallo {{name}}, möchten Sie an einer Anwenderschulung für Ihr Alix-Gerät teilnehmen? Wir haben freie Termine. Ihr Alix Team",
  mediapaket: "Hallo {{name}}, Ihr Mediapaket ist noch nicht abgeschlossen. Wir benötigen nur wenige Daten - melden Sie sich kurz. Ihr Alix Team",
  feedback: "Hallo {{name}}, wie zufrieden sind Sie mit Alix? Ein kurzes Feedback würde uns sehr helfen. Vielen Dank! Ihr Alix Team",
  callback: "Hallo {{name}}, wir möchten Sie zurückrufen. Wann passt es Ihnen am besten? Ihr Alix Team",
  generic: "Hallo {{name}}, Ihr Alix After-Sales-Team meldet sich kurz - alles ok mit Ihrem Gerät? Ihr Alix Team",
};

const KIND_TO_REMINDER: Record<Kind, string> = {
  app: "app", nisv: "nisv", schulung: "schulung",
  mediapaket: "mediapaket", feedback: "feedback",
  callback: "callback", generic: "callback",
};

function normalizeE164(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+49" + s.slice(1);
  if (!s.startsWith("+")) s = "+" + s;
  return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
}

async function loadTwilio() {
  const { data } = await admin.from("sms_settings").select("account_sid, auth_token, from_number").eq("id", true).maybeSingle();
  return {
    sid: data?.account_sid?.trim() || ENV_SID,
    token: data?.auth_token?.trim() || ENV_TOKEN,
    from: data?.from_number?.trim() || ENV_SMS_FROM,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const isService = authHeader?.includes(SERVICE_ROLE);
    let userId: string | null = null;
    if (!isService) {
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
      });
      const { data: claims, error } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
      if (error || !claims?.claims) return json({ error: "Unauthorized" }, 401);
      userId = claims.claims.sub as string;
    }

    const body = await req.json().catch(() => ({}));
    const { case_id, kind = "generic", recipient_phone, custom_text } = body ?? {};
    if (!case_id) return json({ error: "case_id fehlt" }, 400);

    const { data: c } = await admin.from("as_cases_list_v" as any).select("*").eq("id", case_id).maybeSingle();
    if (!c) return json({ error: "Fall nicht gefunden" }, 404);

    const rawPhone = recipient_phone ?? (c as any).customer_phone;
    const to = rawPhone ? normalizeE164(String(rawPhone)) : null;
    if (!to) return json({ error: "Keine gültige Mobilnummer" }, 400);

    const cfg = await loadTwilio();
    if (!cfg.sid || !cfg.token || !cfg.from) return json({ error: "Twilio nicht konfiguriert" }, 500);

    const name = (c as any).customer_contact ?? (c as any).customer_company ?? "";
    const text = (custom_text ?? SMS_TEMPLATES[kind as Kind] ?? SMS_TEMPLATES.generic).replace(/\{\{name\}\}/g, name);

    const auth = btoa(`${cfg.sid}:${cfg.token}`);
    const form = new URLSearchParams({ To: to, From: cfg.from, Body: text });

    let ok = false; let errMsg: string | null = null; let sid: string | null = null;
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) errMsg = `Twilio ${res.status}: ${data?.message ?? JSON.stringify(data)}`;
      else { ok = true; sid = data?.sid ?? null; }
    } catch (e: any) {
      errMsg = e?.message ?? "Twilio Fehler";
    }

    await admin.from("as_reminders" as any).insert({
      case_id, kind: KIND_TO_REMINDER[kind as Kind] ?? "callback",
      scheduled_at: new Date().toISOString(),
      sent_at: ok ? new Date().toISOString() : null,
      channel: "sms",
    });
    await admin.from("as_timeline_events" as any).insert({
      case_id,
      event_type: "sms_reminder",
      title: ok ? `SMS gesendet (${kind}) → ${to}` : `SMS-Versand fehlgeschlagen (${kind})`,
      body: ok ? text : errMsg,
      source: userId ? "user" : "system",
      created_by: userId,
    });

    if (!ok) return json({ ok: false, error: errMsg }, 502);
    return json({ ok: true, to, kind, sid });
  } catch (e: any) {
    return json({ error: e?.message ?? "Unbekannter Fehler" }, 500);
  }
});
