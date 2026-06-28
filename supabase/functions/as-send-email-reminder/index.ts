// as-send-email-reminder
// Sendet eine After-Sales-Erinnerung per Email an den Kunden eines Falls
// und protokolliert die Aktion in as_reminders + as_timeline_events.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Kind = "app" | "nisv" | "schulung" | "mediapaket" | "feedback" | "callback" | "generic";

const KIND_TO_REMINDER: Record<Kind, string> = {
  app: "app", nisv: "nisv", schulung: "schulung",
  mediapaket: "mediapaket", feedback: "feedback",
  callback: "callback", generic: "callback",
};

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
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
      if (cErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
      userId = claims.claims.sub as string;
    }

    const body = await req.json().catch(() => ({}));
    const { case_id, kind = "generic", recipient_email, custom_message, cta_url, cta_label } = body ?? {};
    if (!case_id) return json({ error: "case_id fehlt" }, 400);

    // Load case + customer + order context
    const { data: c, error: caseErr } = await admin
      .from("as_cases_list_v" as any).select("*").eq("id", case_id).maybeSingle();
    if (caseErr || !c) return json({ error: "Fall nicht gefunden" }, 404);

    const to = recipient_email ?? (c as any).customer_email;
    if (!to) return json({ error: "Keine Empfänger-Email gefunden" }, 400);

    const templateData = {
      customerName: (c as any).customer_contact ?? (c as any).customer_company ?? "",
      kind,
      orderNumber: (c as any).order_number ?? (c as any).internal_number ?? "",
      deviceModel: (c as any).device_model ?? "",
      ctaUrl: cta_url ?? "https://alixwork.de",
      ctaLabel: cta_label,
      customMessage: custom_message,
    };

    // Invoke send-transactional-email via internal HTTP call (service role)
    const sendUrl = `${SUPABASE_URL}/functions/v1/send-transactional-email`;
    const resp = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
      },
      body: JSON.stringify({
        templateName: "as-customer-reminder",
        recipientEmail: to,
        idempotencyKey: `as-${case_id}-${kind}-${new Date().toISOString().slice(0, 10)}`,
        templateData,
      }),
    });
    const sendOk = resp.ok;
    let sendInfo: any = null;
    try { sendInfo = await resp.json(); } catch { /* noop */ }

    // Log reminder + timeline
    await admin.from("as_reminders" as any).insert({
      case_id,
      kind: KIND_TO_REMINDER[kind as Kind] ?? "callback",
      scheduled_at: new Date().toISOString(),
      sent_at: sendOk ? new Date().toISOString() : null,
      channel: "email",
    });

    await admin.from("as_timeline_events" as any).insert({
      case_id,
      event_type: "email_reminder",
      title: sendOk ? `Email gesendet (${kind}) → ${to}` : `Email-Versand fehlgeschlagen (${kind})`,
      body: sendOk ? null : (sendInfo?.error ?? `HTTP ${resp.status}`),
      source: userId ? "user" : "system",
      created_by: userId,
    });

    if (!sendOk) return json({ ok: false, error: sendInfo?.error ?? `HTTP ${resp.status}` }, 502);
    return json({ ok: true, to, kind });
  } catch (e: any) {
    return json({ error: e?.message ?? "Unbekannter Fehler" }, 500);
  }
});
