import { requireCallerAccess } from '../_shared/caller-access.ts';
import { loadTwilioConfig } from '../_shared/twilio-config.ts';
// as-send-sms-reminder
// Sendet eine kurze After-Sales-SMS via Twilio + protokolliert die Aktion.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? '';
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '';
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? '';
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
  return loadTwilioConfig(admin,{sid:ENV_SID,token:ENV_TOKEN,from:ENV_SMS_FROM});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  const access = await requireCallerAccess(req, corsHeaders, ['Super Admin', 'Admin', 'After Sales']);
  if ('response' in access) return access.response;

  try {
    const userId = access.user.id;

    const body = await req.json().catch(() => ({}));
    const { case_id, kind = "generic", recipient_phone, custom_text } = body ?? {};
    if (!case_id) return json({ error: "case_id fehlt" }, 400);
    if (typeof case_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(case_id) || !Object.hasOwn(SMS_TEMPLATES, kind) || (custom_text != null && (typeof custom_text !== 'string' || !custom_text.trim() || custom_text.length > 1600))) return json({ error: 'Invalid reminder input' }, 400);
    const { data: parent, error: parentError } = await access.caller.from('as_cases').select('id,tenant_id').eq('id', case_id).in('tenant_id', access.tenants.map((t: any) => t.id)).maybeSingle();
    if (parentError || !parent) return json({ error: 'Fall nicht verfügbar' }, 404);

    const { data: c } = await admin.from("as_cases_list_v" as any).select("*").eq("id", case_id).maybeSingle();
    if (!c) return json({ error: "Fall nicht gefunden" }, 404);

    const savedPhone = normalizeE164(String((c as any).customer_phone ?? ''));
    if (recipient_phone != null && normalizeE164(String(recipient_phone)) !== savedPhone) return json({ error: 'SMS-Empfänger stimmt nicht mit der Kundenakte überein' }, 400);
    const rawPhone = savedPhone;
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

    await access.caller.from("as_reminders" as any).insert({
      case_id, kind: KIND_TO_REMINDER[kind as Kind] ?? "callback",
      scheduled_at: new Date().toISOString(),
      sent_at: ok ? new Date().toISOString() : null,
      channel: "sms",
    });
    await access.caller.from("as_timeline_events" as any).insert({
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
