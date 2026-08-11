import "../_shared/global-bcc.ts";
// Monatlicher Bewertungs-Report: Kundenbewertungen der Auslieferungen des Vormonats
// als Sammel-E-Mail an das Dispositionsteam.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const BCC = ["rde@alix-lasers.com", "k.trinh@alix-operation.de", "jh@alix-operation.de"];
const BCC_STR = BCC.join(", ");
const FLEET_EMAIL = Deno.env.get("FLEET_NOTIFY_EMAIL") || "tour@alix-lasers.com";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const avg = (n: number[]) => (n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0);
const f1 = (n: number) => (n ? n.toFixed(1) : "–");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const label = from.toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

  const { data: ratings, error } = await sb
    .from("delivery_ratings")
    .select("rating, punctuality, friendliness, instruction_quality, comment, customer_name, driver_id, created_at")
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .limit(2000);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const list = ratings ?? [];
  if (!list.length) {
    return new Response(JSON.stringify({ period: label, ratings: 0, sent: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: drivers } = await sb.from("drivers").select("id, full_name").limit(500);
  const nameById = new Map((drivers ?? []).map((d: any) => [d.id, d.full_name]));

  const num = (k: string) => list.map((r: any) => Number(r[k])).filter((n) => !isNaN(n) && n > 0);
  const overall = avg(num("rating"));

  const byDriver = new Map<string, number[]>();
  for (const r of list as any[]) {
    if (!r.driver_id || !r.rating) continue;
    const arr = byDriver.get(r.driver_id) ?? [];
    arr.push(Number(r.rating));
    byDriver.set(r.driver_id, arr);
  }

  const driverRows = [...byDriver.entries()]
    .map(([id, arr]) => ({ name: nameById.get(id) ?? "Unbekannt", count: arr.length, avg: avg(arr) }))
    .sort((a, b) => b.avg - a.avg)
    .map(
      (d) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(d.name)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${d.count}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${f1(d.avg)} / 5</td></tr>`,
    )
    .join("");

  const critical = (list as any[])
    .filter((r) => Number(r.rating) > 0 && Number(r.rating) <= 3)
    .map(
      (r) =>
        `<li>${f1(Number(r.rating))}/5 – ${esc(r.customer_name || "Kunde")}${r.comment ? `: „${esc(r.comment)}“` : ""}</li>`,
    )
    .join("");

  const html = `<div style="font-family:Arial;font-size:14px">
    <h2 style="margin:0 0 12px">Kundenbewertungen Auslieferung – ${esc(label)}</h2>
    <p><b>${list.length}</b> Bewertungen · Gesamt <b>${f1(overall)} / 5</b><br/>
      Pünktlichkeit ${f1(avg(num("punctuality")))} · Freundlichkeit ${f1(avg(num("friendliness")))} · Einweisung ${f1(avg(num("instruction_quality")))}</p>
    <h3 style="margin:16px 0 6px">Fahrer</h3>
    <table style="border-collapse:collapse;width:100%"><thead><tr>
      <th align="left" style="padding:6px 10px;border-bottom:2px solid #ddd">Fahrer</th>
      <th align="left" style="padding:6px 10px;border-bottom:2px solid #ddd">Bewertungen</th>
      <th align="left" style="padding:6px 10px;border-bottom:2px solid #ddd">Ø</th>
    </tr></thead><tbody>${driverRows || '<tr><td colspan="3" style="padding:6px 10px">Keine Zuordnung</td></tr>'}</tbody></table>
    ${critical ? `<h3 style="margin:16px 0 6px;color:#b91c1c">Kritische Rückmeldungen</h3><ul>${critical}</ul>` : ""}
  </div>`;

  let sent = false;
  if (RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Alix Lasers ® <noreply@alixlasers.ai>",
        to: [FLEET_EMAIL],
        bcc: [...([] as string[]).concat(BCC as any), "service@alix-lasers.com"],
        subject: `Bewertungs-Report Auslieferung ${label}: Ø ${f1(overall)} / 5 (${list.length})`,
        html,
      }),
    }).catch(() => {});
    sent = true;
  }

  return new Response(JSON.stringify({ period: label, ratings: list.length, average: Number(overall.toFixed(2)), sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});