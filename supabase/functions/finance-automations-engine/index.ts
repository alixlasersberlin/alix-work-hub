// Phase 11: Automations Engine
// Cron alle 15 Min. Evaluiert aktive Regeln & führt Aktionen aus.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireProcessAccess } from '../_shared/process-access.ts';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const access = await requireProcessAccess(req, corsHeaders, ['Super Admin', 'Admin']);
  if ('response' in access) return access.response;
  const supabase = access.client;

  try {
    let ruleQuery = supabase
      .from("finance_automations")
      .select("*")
      .eq("active", true);
    if (!access.machine) ruleQuery = ruleQuery.or(`tenant_id.in.(${access.tenantIds.join(',')}),tenant_id.is.null`);
    const { data: rules, error: ruleError } = await ruleQuery;
    if (ruleError) throw ruleError;

    const results: any[] = [];
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    for (const rule of rules ?? []) {
      try {
        let executed = 0;
        let message = "";

        switch (rule.trigger_type) {
          case "invoice_threshold": {
            const threshold = Number(rule.condition_json?.amount_gross_gte ?? 0);
            let invoiceQuery = supabase
              .from("finance_incoming_invoices")
              .select("id, amount_gross, supplier_name, invoice_number")
              .gte("amount_gross", threshold)
              .gte("created_at", since);
            if (!access.machine) invoiceQuery = invoiceQuery.in('tenant_id', rule.tenant_id ? [rule.tenant_id] : access.tenantIds);
            const { data: invs, error: invoiceError } = await invoiceQuery;
            if (invoiceError) throw invoiceError;
            for (const inv of invs ?? []) {
              await runAction(supabase, rule, "finance_incoming_invoices", inv.id, inv);
              executed++;
            }
            message = `${executed} Rechnungen >= ${threshold}€ verarbeitet`;
            break;
          }
          case "anomaly_detected": {
            const sev = rule.condition_json?.severity ?? "high";
            let anomalyQuery = supabase
              .from("finance_anomalies")
              .select("id, severity, source_type")
              .eq("status", "open")
              .eq("severity", sev)
              .gte("created_at", since);
            if (!access.machine) anomalyQuery = anomalyQuery.in('tenant_id', rule.tenant_id ? [rule.tenant_id] : access.tenantIds);
            const { data: anos, error: anomalyError } = await anomalyQuery;
            if (anomalyError) throw anomalyError;
            for (const a of anos ?? []) {
              await runAction(supabase, rule, "finance_anomalies", a.id, a);
              executed++;
            }
            message = `${executed} Anomalien (${sev}) verarbeitet`;
            break;
          }
          case "reminder_stage_reached": {
            const stage = Number(rule.condition_json?.stage ?? 2);
            let reminderQuery = supabase
              .from("finance_reminders")
              .select("id, level, customer_id")
              .gte("level", stage)
              .gte("created_at", since);
            if (!access.machine) reminderQuery = reminderQuery.in('tenant_id', rule.tenant_id ? [rule.tenant_id] : access.tenantIds);
            const { data: rems, error: reminderError } = await reminderQuery;
            if (reminderError) throw reminderError;
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
