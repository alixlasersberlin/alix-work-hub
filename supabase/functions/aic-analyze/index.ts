// Alix Intelligence Center – KI-Analyse
// Liest Geschäftsdaten, ruft Lovable AI (Gemini) und schreibt Insights, Forecasts, Tasks.
// Nur Super Admin (verify_jwt = true; serverseitig zusätzlich geprüft).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `Du bist die zentrale KI eines deutschen Medizintechnik-Vertriebs ("Alix Finance / Alix Lasers").
Analysiere die übergebenen Geschäftskennzahlen knapp, präzise, faktenbasiert.
Antworte STRENG als JSON, kein Markdown, kein Kommentar. Schema:
{
 "summary": "1-2 Sätze Gesamtlage",
 "insights": [
   {"module":"unternehmen|forderungen|vertrieb|service|mitarbeiter",
    "category":"chance|risiko|empfehlung",
    "title":"kurz",
    "description":"1-3 Sätze, konkret",
    "severity":1,
    "entity_type":null,
    "entity_id":null}
 ],
 "tasks": [
   {"task_type":"anruf|angebot|mahnung|wartung|schulung|sonstiges",
    "title":"kurz",
    "description":"konkret",
    "priority":3,
    "customer_id":null,
    "order_id":null}
 ],
 "forecasts": [
   {"kind":"umsatz_30d|umsatz_90d|reparaturen|kampagnen|lager",
    "value":12345,
    "unit":"EUR|Stück",
    "confidence":0.7,
    "rationale":"Begründung in 1 Satz"}
 ]
}
Gib pro Bereich (Unternehmen, Forderungen, Vertrieb, Service, Mitarbeiter) mindestens 1, höchstens 4 Insights aus.
Erzeuge 3-8 priorisierte tasks. Erzeuge alle 5 forecast-kinds genau einmal.`;

async function callAi(payload: unknown): Promise<any> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "Kennzahlen (JSON):\n" + JSON.stringify(payload, null, 2) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (res.status === 402) throw new Error("CREDITS_EXHAUSTED");
  if (!res.ok) throw new Error("AI_ERROR: " + (await res.text()));
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(text); }
  catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    return {};
  }
}

async function collectStats(sb: ReturnType<typeof createClient>) {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const d90 = new Date(now.getTime() - 90 * 86400000).toISOString();

  const [
    custCnt, vipCnt, ordersOpen, ordersHold, ordersLawyer,
    orders30, orders90, repairs, repairsOpen,
    unpaid, mailsOut, campaigns, internalMsgs,
    productionApprovals,
  ] = await Promise.all([
    sb.from("customers").select("id", { count: "exact", head: true }),
    sb.from("customers").select("id", { count: "exact", head: true }).eq("is_vip", true),
    sb.from("orders").select("id, total_amount, currency", { count: "exact" }).in("order_status", ["offen", "open", "Open", "Offen"]).limit(500),
    sb.from("orders").select("id", { count: "exact", head: true }).eq("order_status", "Hold"),
    sb.from("orders").select("id", { count: "exact", head: true }).eq("order_status", "Anwalt"),
    sb.from("orders").select("id, total_amount, currency, order_status, order_date").gte("order_date", d30).limit(2000),
    sb.from("orders").select("id, total_amount, currency, order_date").gte("order_date", d90).limit(5000),
    sb.from("repair_orders").select("id, repair_status, actual_cost, estimated_cost, currency, created_at").gte("created_at", d90).limit(1000),
    sb.from("repair_orders").select("id", { count: "exact", head: true }).not("repair_status", "in", "(\"Abgeschlossen\",\"Storniert\",\"Geliefert\",\"Geschlossen\")"),
    sb.from("zoho_unpaid_invoices").select("invoice_number, customer_name, total, balance, due_date, status").gte("balance", 0.01).limit(200),
    sb.from("mail_messages").select("id, direction, status, sent_at", { count: "exact" }).gte("created_at", d30).limit(2000),
    sb.from("mail_campaigns").select("id, name, status, recipient_count, sent_at, scheduled_at").gte("created_at", d90).limit(50),
    sb.from("mail_messages").select("id", { count: "exact", head: true }).eq("direction", "internal").gte("created_at", d30),
    sb.from("production_orders").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
  ]);

  const sum = (rows: any[] | null, k: string) =>
    (rows ?? []).reduce((s, r) => s + (Number(r?.[k]) || 0), 0);

  const revenue30 = sum(orders30.data, "total_amount");
  const revenue90 = sum(orders90.data, "total_amount");
  const openOrdersValue = sum(ordersOpen.data, "total_amount");
  const repairCost90 = sum(repairs.data, "actual_cost") + sum(repairs.data, "estimated_cost");
  const totalUnpaid = sum(unpaid.data, "balance");
  const overdueInvoices = (unpaid.data ?? []).filter((i: any) =>
    i.due_date && new Date(i.due_date) < now).length;

  const topUnpaid = (unpaid.data ?? [])
    .sort((a: any, b: any) => Number(b.balance) - Number(a.balance))
    .slice(0, 10)
    .map((i: any) => ({
      kunde: i.customer_name, rechnung: i.invoice_number,
      offen: Number(i.balance), faellig: i.due_date, status: i.status,
    }));

  return {
    stand: now.toISOString(),
    kunden: { gesamt: custCnt.count ?? 0, vip: vipCnt.count ?? 0 },
    auftraege: {
      offen_anzahl: ordersOpen.count ?? 0,
      offen_volumen: Math.round(openOrdersValue),
      hold: ordersHold.count ?? 0,
      anwalt: ordersLawyer.count ?? 0,
      letzte_30_tage_anzahl: (orders30.data ?? []).length,
      umsatz_30_tage: Math.round(revenue30),
      umsatz_90_tage: Math.round(revenue90),
    },
    produktion: { pending_freigaben: productionApprovals.count ?? 0 },
    reparaturen: {
      offen: repairsOpen.count ?? 0,
      letzte_90_tage: (repairs.data ?? []).length,
      kostenvolumen_90_tage: Math.round(repairCost90),
    },
    forderungen: {
      offene_rechnungen: (unpaid.data ?? []).length,
      offen_gesamt: Math.round(totalUnpaid),
      ueberfaellig: overdueInvoices,
      top_kunden: topUnpaid,
    },
    kommunikation: {
      mails_30_tage: mailsOut.count ?? 0,
      interne_nachrichten_30_tage: internalMsgs.count ?? 0,
      kampagnen_90_tage: (campaigns.data ?? []).length,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return Response.json({ error: "LOVABLE_API_KEY missing" }, { status: 500, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const trigger: "manual" | "cron" = body?.trigger === "cron" ? "cron" : "manual";
    let triggeredBy: string | null = null;

    // Authentifizierung / Super-Admin-Check für manuelle Aufrufe
    if (trigger === "manual") {
      const authHeader = req.headers.get("Authorization") || "";
      const userSb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: u } = await userSb.auth.getUser();
      if (!u?.user) return Response.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders });
      const { data: isAdmin } = await userSb.rpc("has_role", { check_role: "Super Admin" });
      if (!isAdmin) return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
      triggeredBy = u.user.id;
    } else {
      // Cron: braucht CRON_SECRET
      const sec = req.headers.get("x-cron-secret") || "";
      if (sec !== Deno.env.get("CRON_SECRET")) {
        return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
      }
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Run anlegen
    const { data: run } = await sb.from("aic_analysis_runs").insert({
      trigger, status: "running", modules: ["unternehmen", "forderungen", "vertrieb", "service", "mitarbeiter", "forecast"],
      triggered_by: triggeredBy,
    }).select("id").single();
    const runId = run!.id as string;
    const startedAt = Date.now();

    try {
      const stats = await collectStats(sb);
      const ai = await callAi(stats);

      const insights = Array.isArray(ai.insights) ? ai.insights : [];
      const tasks = Array.isArray(ai.tasks) ? ai.tasks : [];
      const forecasts = Array.isArray(ai.forecasts) ? ai.forecasts : [];

      if (insights.length) {
        await sb.from("aic_insights").insert(insights.map((i: any) => ({
          module: String(i.module || "unternehmen").slice(0, 40),
          category: ["chance", "risiko", "empfehlung"].includes(i.category) ? i.category : "empfehlung",
          title: String(i.title || "").slice(0, 200),
          description: i.description ? String(i.description) : null,
          severity: Math.max(1, Math.min(5, Number(i.severity) || 3)),
          entity_type: i.entity_type || null,
          entity_id: i.entity_id ? String(i.entity_id) : null,
          payload: i.payload || {},
          run_id: runId,
          created_by: triggeredBy,
        })));
      }

      if (tasks.length) {
        await sb.from("aic_tasks").insert(tasks.map((t: any) => ({
          task_type: ["anruf", "angebot", "mahnung", "wartung", "schulung"].includes(t.task_type) ? t.task_type : "sonstiges",
          title: String(t.title || "").slice(0, 200),
          description: t.description ? String(t.description) : null,
          priority: Math.max(1, Math.min(5, Number(t.priority) || 3)),
          customer_id: null,
          order_id: null,
          payload: t.payload || {},
          run_id: runId,
        })));
      }

      if (forecasts.length) {
        await sb.from("aic_forecasts").insert(forecasts.map((f: any) => ({
          kind: ["umsatz_30d", "umsatz_90d", "reparaturen", "kampagnen", "lager"].includes(f.kind) ? f.kind : "umsatz_30d",
          value: Number(f.value) || null,
          unit: f.unit ? String(f.unit) : null,
          confidence: Number(f.confidence) || null,
          rationale: f.rationale ? String(f.rationale) : null,
          payload: { stats_snapshot: stats },
          run_id: runId,
          valid_until: new Date(Date.now() + 7 * 86400000).toISOString(),
        })));
      }

      const duration = Date.now() - startedAt;
      await sb.from("aic_analysis_runs").update({
        status: "success",
        finished_at: new Date().toISOString(),
        duration_ms: duration,
        stats: { insights: insights.length, tasks: tasks.length, forecasts: forecasts.length, summary: ai.summary || null, snapshot: stats },
      }).eq("id", runId);

      return Response.json({
        ok: true, runId,
        counts: { insights: insights.length, tasks: tasks.length, forecasts: forecasts.length },
        summary: ai.summary || null,
      }, { headers: corsHeaders });
    } catch (e: any) {
      await sb.from("aic_analysis_runs").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
        error: String(e?.message || e),
      }).eq("id", runId);
      throw e;
    }
  } catch (e: any) {
    const msg = String(e?.message || e);
    const status = msg === "RATE_LIMIT" ? 429 : msg === "CREDITS_EXHAUSTED" ? 402 : 500;
    return Response.json({ error: msg }, { status, headers: corsHeaders });
  }
});
