import "../_shared/global-bcc.ts";
// Phase 3 – Erinnerungs-Engine: 1x pro Tag eine Erinnerung (24h, 48h, 72h) = insgesamt 3 Tage,
// danach (96h) automatische Stornierung. Pro Stufe wird max. 1 E-Mail versendet (Dedupe über delivery_email_logs).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const BCC = ["rde@alix-lasers.com", "k.trinh@alix-operation.de", "jh@alix-operation.de"];
const BCC_STR = BCC.join(", ");

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const result = { checked: 0, reminders: 0, escalations: 0 };

  try {
    const { data: settingsRows } = await sb.from("delivery_settings").select("setting_key, setting_value");
    const settings = Object.fromEntries((settingsRows ?? []).map((r: any) => [r.setting_key, r.setting_value]));
    // Täglich 1 Erinnerung über 3 Tage, danach Stornierung.
    const stages: number[] = settings?.reminder_hours?.stages ?? [24, 48, 72, 96];
    const cancelAfterHours: number = Number(settings?.reminder_cancel_hours?.value ?? 96);
    const escalateTo: string = settings?.reminder_escalation_email?.value ?? "tour@alix-lasers.com";


    const { data: appts } = await sb
      .from("delivery_appointments")
      .select("id, order_number, customer_name, contact_email, contact_name, planned_date, time_window_start, time_window_end, status, updated_at")
      .in("status", ["bestaetigung_versendet", "kunde_geoeffnet"])
      .limit(500);

    for (const appt of appts ?? []) {
      result.checked++;
      const { data: tok } = await sb
        .from("delivery_confirmation_tokens")
        .select("id, created_at, expires_at, revoked, used_at")
        .eq("appointment_id", appt.id)
        .is("used_at", null)
        .eq("revoked", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!tok) continue;
      if (tok.expires_at && new Date(tok.expires_at) < new Date()) continue;

      const hoursSince = (Date.now() - new Date(tok.created_at).getTime()) / 3_600_000;
      const dueStage = [...stages].sort((a, b) => b - a).find((h) => hoursSince >= h);
      if (dueStage == null) continue;

      const isCancellation = dueStage >= cancelAfterHours;
      const kind = isCancellation ? "cancellation" : `reminder_${dueStage}h`;

      const { count } = await sb
        .from("delivery_email_logs")
        .select("id", { count: "exact", head: true })
        .eq("appointment_id", appt.id)
        .eq("kind", kind);
      if ((count ?? 0) > 0) continue;

      const to = (appt.contact_email || "").trim();
      if (!to.includes("@")) continue;

      const subject = isCancellation
        ? `Stornierung Ihres Liefertermins${appt.order_number ? ` (${appt.order_number})` : ""}`
        : `Erinnerung: Bitte bestätigen Sie Ihren Liefertermin${appt.order_number ? ` (${appt.order_number})` : ""}`;

      const html = isCancellation
        ? `<div style="font-family:Arial;font-size:14px"><p>Guten Tag ${esc(appt.contact_name || appt.customer_name || "")},</p><p>leider haben wir trotz mehrfacher Erinnerung keine Bestätigung für den vorgeschlagenen Liefertermin erhalten. Wir müssen den Termin daher <b>stornieren</b>.</p><p>Bitte melden Sie sich bei uns, damit wir einen neuen Termin vereinbaren können.</p><p>Freundliche Grüße<br/>Ihr Alix Auslieferungsteam</p></div>`
        : `<div style="font-family:Arial;font-size:14px"><p>Guten Tag ${esc(appt.contact_name || appt.customer_name || "")},</p><p>wir haben Ihnen einen Liefertermin vorgeschlagen und bisher keine Rückmeldung erhalten. Bitte bestätigen Sie den Termin über den Link aus unserer letzten E-Mail.</p><p>Ohne Bestätigung müssen wir den Termin nach drei Erinnerungen leider stornieren.</p><p>Freundliche Grüße<br/>Ihr Alix Auslieferungsteam</p></div>`;

      if (RESEND_API_KEY) {
        await fetch("https://connector-gateway.lovable.dev/resend/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Alix Lasers ® <noreply@alixlasers.ai>",
            to: [to],
            bcc: [...([] as string[]).concat(isCancellation ? [...BCC, escalateTo] : BCC as any), "service@alix-lasers.com"],
            subject,
            html,
          }),
        }).catch(() => {});
      }

      await sb.from("delivery_email_logs").insert({
        appointment_id: appt.id,
        kind,
        recipient: to,
        bcc: BCC_STR,
        subject,
        status: RESEND_API_KEY ? "sent" : "skipped",
        sent_at: new Date().toISOString(),
      }).then(() => {}, () => {});

      if (isCancellation) {
        result.escalations++;
        await sb.from("delivery_confirmation_tokens").update({ revoked: true }).eq("appointment_id", appt.id).is("used_at", null);
        await sb.from("delivery_appointments").update({ status: "storniert", failure_reason: "Keine Terminbestätigung durch den Kunden (3 Erinnerungen)" }).eq("id", appt.id);
        await sb.from("delivery_notifications").insert({
          appointment_id: appt.id,
          event_type: "confirmation_cancelled",
          title: `Termin storniert – ${appt.customer_name ?? ""}`,
          body: `Keine Bestätigung nach 3 Erinnerungen (Auftrag ${appt.order_number ?? "-"}).`,
          target_role: "Tourenplanung",
          channel: "app",
        }).then(() => {}, () => {});
      } else {
        result.reminders++;
      }
    }


    return Response.json({ ok: true, ...result }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: String((e as Error).message ?? e), ...result }, { status: 500, headers: corsHeaders });
  }
});