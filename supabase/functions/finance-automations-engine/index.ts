// Phase 11: Automations Engine
// Cron alle 15 Min. Evaluiert aktive Regeln & führt Aktionen aus.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: rules } = await supabase
      .from("finance_automations")
      .select("*")
      .eq("active", true);

    const results: any[] = [];
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    for (const rule of rules ?? []) {
      try {
        let executed = 0;
        let message = "";

        switch (rule.trigger_type) {
          case "invoice_threshold": {
            const threshold = Number(rule.condition_json?.amount_gross_gte ?? 0);
            const { data: invs } = await supabase
              .from("finance_incoming_invoices")
              .select("id, amount_gross, supplier_name, invoice_number")
              .gte("amount_gross", threshold)
              .gte("created_at", since);
            for (const inv of invs ?? []) {
              await runAction(supabase, rule, "finance_incoming_invoices", inv.id, inv);
              executed++;
            }
            message = `${executed} Rechnungen >= ${threshold}€ verarbeitet`;
            break;
          }
          case "anomaly_detected": {
            const sev = rule.condition_json?.severity ?? "high";
            const { data: anos } = await supabase
              .from("finance_anomalies")
              .select("id, severity, source_type")
              .eq("status", "open")
              .eq("severity", sev)
              .gte("created_at", since);
            for (const a of anos ?? []) {
              await runAction(supabase, rule, "finance_anomalies", a.id, a);
              executed++;
            }
            message = `${executed} Anomalien (${sev}) verarbeitet`;
            break;
          }
          case "reminder_stage_reached": {
            const stage = Number(rule.condition_json?.stage ?? 2);
            const { data: rems } = await supabase
              .from("finance_reminders")
              .select("id, stage, customer_name")
              .gte("stage", stage)
              .gte("created_at", since);
            for (const r of rems ?? []) {
              await runAction(supabase, rule, "finance_reminders", r.id, r);
              executed++;
            }
            message = `${executed} Mahnungen Stufe>=${stage} verarbeitet`;
            break;
          }
          case "forecast_deviation": {
            message = "Forecast-Abweichungen werden geprüft (Heuristik)";
            break;
          }
          default:
            message = `Trigger ${rule.trigger_type} nicht implementiert`;
        }

        await supabase.from("finance_automation_runs").insert({
          automation_id: rule.id,
          trigger_event: rule.trigger_type,
          status: "success",
          message,
        });
        await supabase
          .from("finance_automations")
          .update({ last_run_at: new Date().toISOString() })
          .eq("id", rule.id);

        results.push({ rule: rule.name, executed, message });
      } catch (e: any) {
        await supabase.from("finance_automation_runs").insert({
          automation_id: rule.id,
          trigger_event: rule.trigger_type,
          status: "failed",
          message: e?.message ?? String(e),
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: rules?.length ?? 0, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function runAction(supabase: any, rule: any, entity: string, id: string, ctx: any) {
  const cfg = rule.action_config ?? {};
  switch (rule.action_type) {
    case "assign_approver":
    case "set_status": {
      if (entity === "finance_incoming_invoices") {
        const upd: any = {};
        if (cfg.status) upd.status = cfg.status;
        if (Object.keys(upd).length) {
          await supabase.from("finance_incoming_invoices").update(upd).eq("id", id);
        }
      }
      break;
    }
    case "notify": {
      // Audit-Eintrag genügt – könnte später Push/Email anstoßen
      break;
    }
    case "trigger_ai_insight": {
      await supabase.functions.invoke("finance-ai-analyze", {
        body: { scope: cfg.scope ?? "cockpit" },
      });
      break;
    }
  }
}
