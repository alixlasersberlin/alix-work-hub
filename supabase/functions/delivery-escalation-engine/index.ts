// delivery-escalation-engine
// Läuft per Cron: berechnet Ampel/ETA-Status neu, erinnert Kunden an offene Terminbestätigungen
// und eskaliert kritische Lieferungen intern (App-Benachrichtigung + Historieneintrag).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const REMINDER_INTERVAL_DAYS = 3;
const MAX_REMINDERS = 2;

function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

type Light = "grau" | "gruen" | "gelb" | "rot";
const RANK: Record<Light, number> = { grau: 0, gruen: 1, gelb: 2, rot: 3 };

function evaluate(r: any, openBlockers: number, tourPlanned: boolean) {
  const delivered = r.phase === "delivered" || Boolean(r.delivered_at);
  const reasons: string[] = [];
  let light: Light = "gruen";
  const esc = (to: Light, reason: string) => {
    reasons.push(reason);
    if (RANK[to] > RANK[light]) light = to;
  };

  if (delivered) return { light: "gruen" as Light, eta_state: "delivered", reasons: ["Geliefert"] };
  if (!r.eta_planned) return { light: "grau" as Light, eta_state: "forecast", reasons: ["Noch kein Liefertermin geplant"] };

  const d = daysUntil(r.eta_planned);
  if (d !== null && d < 0) esc("rot", "Liefertermin überschritten, noch nicht geliefert");
  if (d === 0 && !tourPlanned) esc("rot", "Liefertermin heute, Tour nicht gestartet");
  if (d !== null && d >= 0 && d <= 2 && !tourPlanned) esc("gelb", "Liefertermin in ≤ 2 Tagen, Tour nicht geplant");
  if (d !== null && d >= 0 && d <= 3 && !r.qc_completed_at) esc("gelb", "Liefertermin in ≤ 3 Tagen, Qualitätsprüfung offen");

  const prod = daysUntil(r.production_end_planned);
  if (prod !== null && prod < 0 && !r.qc_completed_at) {
    esc(prod < -7 ? "rot" : "gelb", "Produktionsende überschritten, Produktion nicht abgeschlossen");
  }
  if (r.is_delayed) esc("rot", "Als verzögert markiert");
  if (openBlockers > 0) esc("gelb", `${openBlockers} offene(r) Blocker`);

  let eta_state = "planned";
  if (r.is_delayed || (d !== null && d < 0)) eta_state = "delayed";
  else if (d !== null && d <= 3 && !r.qc_completed_at) eta_state = "at_risk";
  else if (r.eta_confirmed) eta_state = "confirmed";

  if (reasons.length === 0) reasons.push("Lieferung planmäßig");
  return { light, eta_state, reasons };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { data: rows } = await admin
      .from("order_delivery_status")
      .select("*")
      .neq("phase", "delivered")
      .limit(2000);

    const list = rows ?? [];
    if (list.length === 0) return json({ ok: true, checked: 0 });

    const orderIds = list.map((r: any) => r.order_id);

    const { data: blockers } = await admin
      .from("order_delivery_blockers")
      .select("order_id, blocker_status")
      .in("order_id", orderIds)
      .eq("blocker_status", "open");
    const blockerCount = new Map<string, number>();
    for (const b of blockers ?? []) blockerCount.set(b.order_id, (blockerCount.get(b.order_id) ?? 0) + 1);

    let updated = 0;
    let escalated = 0;
    let reminded = 0;
    const criticals: { order_id: string; reasons: string[] }[] = [];

    for (const r of list) {
      const tourPlanned = Boolean(r.tour_id);
      const { light, eta_state, reasons } = evaluate(r, blockerCount.get(r.order_id) ?? 0, tourPlanned);

      const patch: Record<string, unknown> = {};
      if (r.traffic_light !== light) patch.traffic_light = light;
      if (r.eta_state !== eta_state) patch.eta_state = eta_state;

      // Erinnerung an offene Terminbestätigung
      const needsConfirm =
        r.eta_planned && !r.eta_confirmed && !r.customer_response && (r.confirm_reminder_count ?? 0) < MAX_REMINDERS;
      const lastAt = r.confirm_reminder_last_at ? new Date(r.confirm_reminder_last_at).getTime() : 0;
      const dueForReminder = Date.now() - lastAt > REMINDER_INTERVAL_DAYS * 86400000;

      if (needsConfirm && dueForReminder) {
        try {
          const res = await admin.functions.invoke("delivery-notify", {
            body: { order_id: r.order_id, event_key: "confirm_reminder" },
          });
          if (!res.error) {
            patch.confirm_reminder_count = (r.confirm_reminder_count ?? 0) + 1;
            patch.confirm_reminder_last_at = new Date().toISOString();
            reminded += 1;
            await admin.from("order_delivery_comms").insert({
              order_id: r.order_id,
              channel: "email",
              direction: "outbound",
              event_key: "confirm_reminder",
              subject: "Erinnerung: Liefertermin bestätigen",
              success: true,
            });
          }
        } catch { /* Benachrichtigung ist optional */ }
      }

      if (Object.keys(patch).length > 0) {
        await admin.from("order_delivery_status").update(patch).eq("order_id", r.order_id);
        updated += 1;
      }

      if (light === "rot" && r.traffic_light !== "rot") {
        escalated += 1;
        criticals.push({ order_id: r.order_id, reasons });
        await admin.from("order_delivery_events").insert({
          order_id: r.order_id,
          title: "Eskalation: Liefertermin kritisch",
          description: reasons.join(" · "),
          visible_to_customer: false,
        });
      }
    }

    // Interne Benachrichtigung für neu eskalierte Lieferungen
    if (criticals.length > 0) {
      const { data: roleRows } = await admin
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["Super Admin", "Admin", "Tourenplanung"]);
      const userIds = [...new Set((roleRows ?? []).map((x: any) => x.user_id))];
      if (userIds.length > 0) {
        const notifications = userIds.flatMap((uid) =>
          criticals.slice(0, 20).map((c) => ({
            user_id: uid,
            title: "Lieferung kritisch (rot)",
            message: c.reasons.join(" · "),
            type: "warning",
            link: "/dispatch/control-tower",
          })),
        );
        await admin.from("app_notifications").insert(notifications);
      }
    }

    return json({ ok: true, checked: list.length, updated, escalated, reminded });
  } catch (e) {
    console.error("delivery-escalation-engine", e);
    return json({ ok: false, error: String(e) }, 500);
  }
});
