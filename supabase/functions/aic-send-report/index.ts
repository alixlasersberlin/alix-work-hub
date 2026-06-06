// AIC – Management-Bericht erzeugen und per Resend versenden.
// Nutzt zuletzt erzeugte Insights/Forecasts/Tasks.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

function esc(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!));
}

function renderHtml(payload: {
  kind: string; periodStart: string; periodEnd: string;
  summary: string | null;
  insights: any[]; tasks: any[]; forecasts: any[];
}) {
  const sevBadge = (s: number) =>
    s >= 4 ? "background:#7f1d1d;color:#fecaca" : s === 3 ? "background:#78350f;color:#fde68a" : "background:#1e3a8a;color:#bfdbfe";

  const groupedInsights: Record<string, any[]> = {};
  for (const i of payload.insights) (groupedInsights[i.module] ??= []).push(i);

  const insightsHtml = Object.entries(groupedInsights).map(([mod, items]) => `
    <h3 style="margin:24px 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:.5px;color:#d4af37">${esc(mod)}</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      ${items.map((i) => `
        <tr><td style="padding:8px 0;border-top:1px solid #222">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;${sevBadge(i.severity)}">${esc(i.category)} · S${i.severity}</span>
          <strong style="margin-left:8px;color:#fff">${esc(i.title)}</strong>
          <div style="color:#bbb;font-size:13px;margin-top:4px">${esc(i.description || "")}</div>
        </td></tr>`).join("")}
    </table>`).join("");

  const tasksHtml = payload.tasks.map((t) => `
    <tr><td style="padding:6px 0;border-top:1px solid #222">
      <span style="color:#d4af37">P${t.priority}</span> · <strong>${esc(t.task_type)}</strong> · ${esc(t.title)}
      <div style="color:#888;font-size:12px">${esc(t.description || "")}</div>
    </td></tr>`).join("");

  const forecastsHtml = payload.forecasts.map((f) => `
    <tr>
      <td style="padding:6px 8px;border-top:1px solid #222">${esc(f.kind)}</td>
      <td style="padding:6px 8px;border-top:1px solid #222;text-align:right">${f.value != null ? Number(f.value).toLocaleString("de-DE") : "–"} ${esc(f.unit || "")}</td>
      <td style="padding:6px 8px;border-top:1px solid #222;color:#888">${f.confidence != null ? Math.round(Number(f.confidence) * 100) + "%" : ""}</td>
    </tr>`).join("");

  return `<!doctype html><html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,Segoe UI,Inter,sans-serif;color:#eee">
  <div style="max-width:720px;margin:0 auto;padding:32px 24px">
    <div style="padding:24px;background:linear-gradient(135deg,#1a1a1a,#0a0a0a);border:1px solid #d4af37;border-radius:12px">
      <div style="color:#d4af37;font-size:11px;letter-spacing:2px">ALIX INTELLIGENCE CENTER</div>
      <h1 style="margin:6px 0 4px;font-size:24px;color:#fff">${esc(payload.kind.toUpperCase())} REPORT</h1>
      <div style="color:#888;font-size:13px">${esc(payload.periodStart)} – ${esc(payload.periodEnd)}</div>
    </div>
    <div style="padding:24px 8px">
      ${payload.summary ? `<p style="color:#ddd;font-size:15px;line-height:1.5">${esc(payload.summary)}</p>` : ""}
      <h2 style="font-size:16px;margin-top:32px;color:#d4af37;border-bottom:1px solid #333;padding-bottom:8px">Erkenntnisse</h2>
      ${insightsHtml || '<p style="color:#666">Keine Insights vorhanden.</p>'}
      <h2 style="font-size:16px;margin-top:32px;color:#d4af37;border-bottom:1px solid #333;padding-bottom:8px">Prognosen</h2>
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${forecastsHtml || '<tr><td style="color:#666;padding:8px 0">Keine Prognosen.</td></tr>'}</table>
      <h2 style="font-size:16px;margin-top:32px;color:#d4af37;border-bottom:1px solid #333;padding-bottom:8px">Empfohlene Maßnahmen</h2>
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${tasksHtml || '<tr><td style="color:#666;padding:8px 0">Keine Aufgaben.</td></tr>'}</table>
      <p style="margin-top:32px;color:#555;font-size:11px">Automatisch erzeugt durch Alix Intelligence Center · Alix Finance</p>
    </div>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const kind: "daily" | "weekly" | "monthly" | "adhoc" = ["daily", "weekly", "monthly", "adhoc"].includes(body?.kind) ? body.kind : "daily";
    const recipients: string[] = Array.isArray(body?.recipients) ? body.recipients.filter((x: any) => typeof x === "string" && x.includes("@")) : [];
    const send: boolean = body?.send !== false;

    // Authentifizierung: Super Admin oder Cron-Secret
    const cronSec = req.headers.get("x-cron-secret") || "";
    let isAuthorized = cronSec === Deno.env.get("CRON_SECRET");
    if (!isAuthorized) {
      const authHeader = req.headers.get("Authorization") || "";
      const userSb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: u } = await userSb.auth.getUser();
      if (!u?.user) return Response.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders });
      const { data: ok } = await userSb.rpc("has_role", { check_role: "Super Admin" });
      isAuthorized = !!ok;
    }
    if (!isAuthorized) return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const now = new Date();
    const periodDays = kind === "daily" ? 1 : kind === "weekly" ? 7 : kind === "monthly" ? 30 : 1;
    const from = new Date(now.getTime() - periodDays * 86400000);

    const [{ data: insights }, { data: tasks }, { data: forecasts }, { data: lastRun }] = await Promise.all([
      sb.from("aic_insights").select("*").gte("created_at", from.toISOString()).order("severity", { ascending: false }).limit(50),
      sb.from("aic_tasks").select("*").gte("created_at", from.toISOString()).order("priority", { ascending: false }).limit(20),
      sb.from("aic_forecasts").select("*").gte("generated_at", from.toISOString()).order("generated_at", { ascending: false }).limit(20),
      sb.from("aic_analysis_runs").select("stats").eq("status", "success").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const summary = (lastRun?.stats as any)?.summary || null;
    const periodStart = from.toISOString().slice(0, 10);
    const periodEnd = now.toISOString().slice(0, 10);
    const title = `Alix Intelligence – ${kind === "daily" ? "Tages" : kind === "weekly" ? "Wochen" : kind === "monthly" ? "Monats" : "Sonder"}bericht ${periodEnd}`;

    const html = renderHtml({
      kind, periodStart, periodEnd, summary,
      insights: insights ?? [], tasks: tasks ?? [], forecasts: forecasts ?? [],
    });

    let sentStatus: "pending" | "sent" | "failed" = "pending";
    let sendError: string | null = null;

    if (send && recipients.length && RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Alix Intelligence <no-reply@alix-lasers.com>",
          to: recipients, subject: title, html,
        }),
      });
      if (!r.ok) {
        sendError = await r.text();
        sentStatus = "failed";
      } else {
        sentStatus = "sent";
      }
    } else if (send && recipients.length && !RESEND_API_KEY) {
      sendError = "RESEND_API_KEY missing";
      sentStatus = "failed";
    }

    const { data: report } = await sb.from("aic_reports").insert({
      kind, title, summary,
      period_start: periodStart, period_end: periodEnd,
      content_html: html,
      payload: { insights, tasks, forecasts },
      recipients, sent_at: sentStatus === "sent" ? new Date().toISOString() : null,
      send_status: sentStatus, send_error: sendError,
    }).select("id").single();

    return Response.json({
      ok: true, reportId: report?.id, kind, recipients,
      status: sentStatus, error: sendError,
      counts: { insights: insights?.length || 0, tasks: tasks?.length || 0, forecasts: forecasts?.length || 0 },
    }, { headers: corsHeaders });
  } catch (e: any) {
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: corsHeaders });
  }
});
