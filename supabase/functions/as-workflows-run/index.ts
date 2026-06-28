// as-workflows-run
// Tägliche Workflow-Engine für After Sales:
//  - App-fehlt (>3 Tage offen)         → Email-Erinnerung an Kunden
//  - NiSV-fehlt (>7 Tage offen)        → Email-Erinnerung
//  - Schulung-fehlt (>14 Tage offen)   → Email-Vorschlag
//  - Mediapaket offen (>14 Tage)       → Email + Timeline-Hinweis Marketing
//  - Überfällige Rückrufe              → Timeline-Eskalation, Fall-Priorität "urgent"
//
// Jede Aktion wird in as_timeline_events + as_reminders protokolliert.
// Doppel-Versand am gleichen Tag wird vermieden (Idempotenz-Check).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface WorkflowRule {
  kind: "app" | "nisv" | "schulung" | "mediapaket";
  checklistKeyPrefix?: string;
  section?: string;
  minAgeDays: number;
}

const RULES: WorkflowRule[] = [
  { kind: "app",        section: "app",        minAgeDays: 3 },
  { kind: "nisv",       section: "nisv",       minAgeDays: 7 },
  { kind: "schulung",   section: "schulung",   minAgeDays: 14 },
  { kind: "mediapaket", section: "mediapaket", minAgeDays: 14 },
];

async function alreadySentToday(case_id: string, kind: string): Promise<boolean> {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const { data } = await admin
    .from("as_reminders" as any)
    .select("id")
    .eq("case_id", case_id)
    .eq("kind", kind)
    .gte("scheduled_at", today.toISOString())
    .limit(1);
  return !!(data && data.length > 0);
}

async function sendEmail(case_id: string, kind: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/as-send-email-reminder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
    },
    body: JSON.stringify({ case_id, kind }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const summary = { processed: 0, emails: 0, escalations: 0, skipped: 0, errors: [] as string[] };

    // 1) Active cases (open / in_progress / waiting_customer)
    const { data: cases, error } = await admin
      .from("as_cases")
      .select("id, created_at, status, customer_id, traffic_light, priority")
      .in("status", ["open", "in_progress", "waiting_customer"])
      .limit(2000);
    if (error) throw error;

    const now = new Date();

    for (const c of cases ?? []) {
      summary.processed++;
      const ageDays = Math.floor((now.getTime() - new Date(c.created_at as string).getTime()) / 86400000);

      // checklist for this case
      const { data: items } = await admin
        .from("as_checklist_items")
        .select("section, key, checked")
        .eq("case_id", c.id);

      for (const r of RULES) {
        if (ageDays < r.minAgeDays) { summary.skipped++; continue; }
        const sectionItems = (items ?? []).filter((i: any) => i.section === r.section);
        if (sectionItems.length === 0) { summary.skipped++; continue; }
        const anyOpen = sectionItems.some((i: any) => !i.checked);
        if (!anyOpen) { summary.skipped++; continue; }
        if (await alreadySentToday(c.id as string, r.kind)) { summary.skipped++; continue; }
        try {
          const ok = await sendEmail(c.id as string, r.kind);
          if (ok) summary.emails++;
          else summary.errors.push(`email ${r.kind} ${c.id}`);
        } catch (e: any) {
          summary.errors.push(`email ${r.kind} ${c.id}: ${e?.message ?? e}`);
        }
      }
    }

    // 2) Overdue callbacks → escalation
    const { data: overdue } = await admin
      .from("as_callbacks")
      .select("id, case_id, due_at")
      .is("done_at", null)
      .lt("due_at", now.toISOString())
      .limit(1000);

    for (const cb of overdue ?? []) {
      const ageHours = Math.floor((now.getTime() - new Date(cb.due_at as string).getTime()) / 3600000);
      // mark case as urgent + red, log timeline
      await admin.from("as_cases").update({
        priority: "urgent",
        traffic_light: "red",
      }).eq("id", cb.case_id as string);

      // avoid spamming: only log once per day per callback
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      const { data: existing } = await admin
        .from("as_timeline_events" as any)
        .select("id")
        .eq("case_id", cb.case_id as string)
        .eq("event_type", "callback_overdue")
        .gte("created_at", today.toISOString())
        .limit(1);

      if (!existing || existing.length === 0) {
        await admin.from("as_timeline_events" as any).insert({
          case_id: cb.case_id,
          event_type: "callback_overdue",
          title: `Rückruf überfällig (${ageHours}h) – Eskalation an Leitung`,
          body: `Geplant: ${new Date(cb.due_at as string).toLocaleString("de-DE")}`,
          source: "system",
        });
        summary.escalations++;
      }
    }

    return json({ ok: true, summary });
  } catch (e: any) {
    return json({ error: e?.message ?? "Unbekannter Fehler" }, 500);
  }
});
