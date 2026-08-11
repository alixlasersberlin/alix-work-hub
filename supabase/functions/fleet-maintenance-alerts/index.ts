import "../_shared/global-bcc.ts";
// Tägliche Fuhrpark-Wartungs-Erinnerung (Fahrzeuge: HU, Service nach Datum/km, Versicherung)
// Sendet eine Sammel-E-Mail an das Dispositionsteam.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const BCC = "rde@alix-lasers.com";
const FLEET_EMAIL = Deno.env.get("FLEET_NOTIFY_EMAIL") || "tour@alix-lasers.com";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function daysUntil(d?: string | null) {
  if (!d) return null;
  return Math.round((new Date(d + "T00:00:00Z").getTime() - Date.now()) / 86_400_000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const rows: { plate: string; item: string; info: string; level: "overdue" | "soon" }[] = [];

  const { data: vehicles, error } = await sb
    .from("vehicles")
    .select(
      "id, license_plate, name, odometer_km, hu_due_date, insurance_until, next_service_date, service_interval_km, service_interval_months, last_service_km, last_service_date, active",
    )
    .eq("active", true)
    .limit(500);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const push = (v: any, item: string, info: string, days: number | null, kmLeft?: number | null) => {
    const overdue = (days != null && days < 0) || (kmLeft != null && kmLeft < 0);
    const soon = (days != null && days <= 30) || (kmLeft != null && kmLeft <= 1000);
    if (!overdue && !soon) return;
    rows.push({
      plate: `${v.license_plate ?? "-"}${v.name ? ` · ${v.name}` : ""}`,
      item,
      info,
      level: overdue ? "overdue" : "soon",
    });
  };

  for (const v of vehicles ?? []) {
    const hu = daysUntil(v.hu_due_date);
    if (hu != null) push(v, "HU/AU", `fällig ${v.hu_due_date} (${hu} Tage)`, hu);

    const ins = daysUntil(v.insurance_until);
    if (ins != null) push(v, "Versicherung", `läuft ${v.insurance_until} aus (${ins} Tage)`, ins);

    // Service nach Datum
    let serviceDate: string | null = v.next_service_date ?? null;
    if (!serviceDate && v.last_service_date && v.service_interval_months) {
      const d = new Date(v.last_service_date + "T00:00:00Z");
      d.setMonth(d.getMonth() + Number(v.service_interval_months));
      serviceDate = d.toISOString().slice(0, 10);
    }
    const sv = daysUntil(serviceDate);
    if (sv != null) push(v, "Service (Datum)", `fällig ${serviceDate} (${sv} Tage)`, sv);

    // Service nach Kilometern
    if (v.service_interval_km && v.odometer_km != null) {
      const base = Number(v.last_service_km ?? 0);
      const nextKm = base + Number(v.service_interval_km);
      const kmLeft = nextKm - Number(v.odometer_km);
      push(v, "Service (km)", `bei ${nextKm.toLocaleString("de-DE")} km · noch ${kmLeft.toLocaleString("de-DE")} km`, null, kmLeft);
    }
  }

  const overdue = rows.filter((r) => r.level === "overdue");
  let sent = false;

  if (rows.length && RESEND_API_KEY) {
    const tr = rows
      .sort((a, b) => (a.level === b.level ? 0 : a.level === "overdue" ? -1 : 1))
      .map(
        (r) =>
          `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(r.plate)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(r.item)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(r.info)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;color:${r.level === "overdue" ? "#b91c1c" : "#b45309"}">${r.level === "overdue" ? "überfällig" : "fällig bald"}</td></tr>`,
      )
      .join("");
    const html = `<div style="font-family:Arial;font-size:14px">
      <h2 style="margin:0 0 12px">Fuhrpark – Wartung & Prüfungen</h2>
      <p>${rows.length} Hinweis(e), davon ${overdue.length} überfällig.</p>
      <table style="border-collapse:collapse;width:100%"><thead><tr>
        <th align="left" style="padding:6px 10px;border-bottom:2px solid #ddd">Fahrzeug</th>
        <th align="left" style="padding:6px 10px;border-bottom:2px solid #ddd">Position</th>
        <th align="left" style="padding:6px 10px;border-bottom:2px solid #ddd">Details</th>
        <th align="left" style="padding:6px 10px;border-bottom:2px solid #ddd">Status</th>
      </tr></thead><tbody>${tr}</tbody></table>
    </div>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Alix Lasers ® <noreply@alixlasers.ai>",
        to: [FLEET_EMAIL],
        bcc: [...([] as string[]).concat([BCC] as any), "service@alix-lasers.com"],
        subject: `Fuhrpark: ${rows.length} Wartungs-/Prüfhinweise (${overdue.length} überfällig)`,
        html,
      }),
    }).catch(() => {});
    sent = true;
  }

  return new Response(JSON.stringify({ vehicles: vehicles?.length ?? 0, alerts: rows.length, overdue: overdue.length, sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});