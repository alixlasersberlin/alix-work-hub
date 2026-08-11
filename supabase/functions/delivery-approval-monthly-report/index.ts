import "../_shared/global-bcc.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Stage = "warehouse" | "accounting" | "dispatch";
const STAGES: Stage[] = ["warehouse", "accounting", "dispatch"];
const TITLE: Record<Stage, string> = {
  warehouse: "Bereitstellung",
  accounting: "Buchhaltung",
  dispatch: "Tourenplanung",
};
const FROM = "Alix Lasers ® <service@alixwork.de>";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmtH = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)} h`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: setting } = await supabase
      .from("app_settings").select("value").eq("key", "delivery_approval_sla").maybeSingle();
    let cfg: any = setting?.value ?? {};
    if (typeof cfg === "string") { try { cfg = JSON.parse(cfg); } catch { cfg = {}; } }

    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;
    const recipients: string[] = Array.isArray(cfg?.monthlyReport?.recipients) ? cfg.monthlyReport.recipients : [];
    if (!force && (!cfg?.monthlyReport?.enabled || !recipients.length)) {
      return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const to = (body?.recipients as string[] | undefined)?.length ? body.recipients : recipients;
    if (!to?.length) {
      return new Response(JSON.stringify({ ok: true, skipped: "no recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Vormonat
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const { data: rows } = await supabase
      .from("delivery_approvals")
      .select("id, created_at, warehouse_at, accounting_at, dispatch_at, overall_status")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .limit(5000);

    const list = (rows ?? []) as any[];
    const hours = (a: string | null, b: string | null) =>
      a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000 : null;

    const perStage: Record<Stage, number | null> = { warehouse: null, accounting: null, dispatch: null };
    const prevField: Record<Stage, string> = {
      warehouse: "created_at", accounting: "warehouse_at", dispatch: "accounting_at",
    };
    for (const s of STAGES) {
      const vals = list
        .map((r) => hours(r[prevField[s]], r[`${s}_at`]))
        .filter((v): v is number => v != null && v >= 0);
      perStage[s] = avg(vals);
    }
    const totalVals = list
      .map((r) => hours(r.created_at, r.dispatch_at))
      .filter((v): v is number => v != null && v >= 0);
    const total = avg(totalVals);
    const released = list.filter((r) => ["released", "delivered", "completed"].includes(r.overall_status)).length;

    const targets = cfg?.targets ?? {};
    const monthLabel = start.toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

    const row = (label: string, val: number | null, target?: number) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${label}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right"><strong>${fmtH(val)}</strong></td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:#666">${
          target ? `${target} h` : "—"
        }</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${
          val == null || !target ? "—" : val <= target ? "🟢" : val <= target * 1.5 ? "🟡" : "🔴"
        }</td>
      </tr>`;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
        <h2 style="color:#a8871f;margin:0 0 4px">Auslieferungsfreigabe – Monatsreport ${monthLabel}</h2>
        <p style="color:#555;margin:0 0 16px">
          ${list.length} Vorgänge angelegt · ${released} freigegeben
        </p>
        <table style="border-collapse:collapse;width:100%;max-width:620px">
          <thead><tr style="background:#f5f5f5">
            <th style="text-align:left;padding:6px 10px">Stufe</th>
            <th style="text-align:right;padding:6px 10px">Ø Dauer</th>
            <th style="text-align:right;padding:6px 10px">Ziel</th>
            <th style="padding:6px 10px">Status</th>
          </tr></thead>
          <tbody>
            ${STAGES.map((s) => row(TITLE[s], perStage[s], targets[s])).join("")}
            ${row("Gesamtdurchlauf", total, targets.total)}
          </tbody>
        </table>
        <p style="margin-top:18px;color:#666;font-size:12px">
          Automatisch erzeugt von AlixWork · Auslieferungsfreigabe
        </p>
      </div>`;

    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) throw new Error("RESEND_API_KEY fehlt");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to,
        subject: `Monatsreport Auslieferungsfreigabe – ${monthLabel}`,
        html,
      }),
    });
    if (!res.ok) throw new Error(await res.text());

    return new Response(JSON.stringify({ ok: true, recipients: to.length, approvals: list.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("delivery-approval-monthly-report", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});