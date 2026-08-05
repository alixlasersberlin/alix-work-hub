import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Nächstes Ausführungsdatum je Intervall. */
function nextDate(from: string, unit: string): string {
  const d = new Date(from + "T00:00:00Z");
  if (unit === "woche") d.setUTCDate(d.getUTCDate() + 7);
  else if (unit === "quartal") d.setUTCMonth(d.getUTCMonth() + 3);
  else if (unit === "jahr") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * CMR Sammelabrechnung (ohne Abo): bündelt offene, abrechenbare Projektzeiten
 * eines Kunden zu einer Sammelrechnung – je Projekt eine Position.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const planId: string | null = body?.planId ?? null;
    const tenantId: string | null = body?.tenantId ?? null;
    const force: boolean = !!body?.force;
    const today = new Date().toISOString().slice(0, 10);

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    let q = sb.from("cmr_collective_plans").select("*").eq("is_active", true);
    if (planId) q = q.eq("id", planId);
    else q = q.lte("next_run_date", today);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    const { data: plans, error } = await q;
    if (error) throw error;

    const { data: projects } = await sb.from("cmr_projects").select("id,name,code,tenant_id");
    const projectById = new Map((projects ?? []).map((p: any) => [p.id, p]));

    let created = 0;
    const results: any[] = [];

    for (const plan of plans ?? []) {
      // Offene, abrechenbare Zeiten des Kunden (optional auf Projekte eingeschränkt)
      let tq = sb.from("cmr_time_entries").select("*")
        .eq("tenant_id", plan.tenant_id)
        .eq("billable", true)
        .is("billed_document_id", null);
      if (plan.customer_id) tq = tq.eq("customer_id", plan.customer_id);
      if (Array.isArray(plan.project_ids) && plan.project_ids.length) tq = tq.in("project_id", plan.project_ids);
      const { data: entries } = await tq;

      if (!entries?.length) {
        results.push({ plan: plan.id, skipped: "keine offenen Zeiten" });
        if (!planId) await sb.from("cmr_collective_plans").update({ next_run_date: nextDate(plan.next_run_date, plan.interval_unit) }).eq("id", plan.id);
        continue;
      }

      // Positionen je Projekt bündeln
      const byProject = new Map<string, { name: string; hours: number; rate: number }>();
      for (const e of entries) {
        const key = e.project_id ?? "ohne";
        const proj = projectById.get(e.project_id);
        const cur = byProject.get(key) ?? {
          name: proj ? `${proj.code ? proj.code + " · " : ""}${proj.name}` : "Leistungen",
          hours: 0,
          rate: Number(e.hourly_rate || 0),
        };
        cur.hours += Number(e.hours || 0);
        byProject.set(key, cur);
      }

      const taxRate = Number(plan.tax_rate || 0);
      let net = 0;
      const items = [...byProject.values()].map((p, i) => {
        const total = Math.round(p.hours * p.rate * 100) / 100;
        net += total;
        return {
          position: i + 1, name: p.name, description: "Zeitaufwand laut Zeiterfassung",
          quantity: p.hours, unit: "Stunde", unit_price: p.rate,
          discount_pct: 0, tax_rate: taxRate, line_total: total,
        };
      });

      if (!force && net < Number(plan.min_amount || 0)) {
        results.push({ plan: plan.id, skipped: `unter Mindestbetrag (${net})` });
        if (!planId) await sb.from("cmr_collective_plans").update({ next_run_date: nextDate(plan.next_run_date, plan.interval_unit) }).eq("id", plan.id);
        continue;
      }

      const { data: nr, error: nrErr } = await sb.rpc("cmr_next_document_number", {
        _tenant_id: plan.tenant_id, _doc_type: "rechnung",
      });
      if (nrErr) { results.push({ plan: plan.id, error: nrErr.message }); continue; }

      const tax = Math.round(net * (taxRate / 100) * 100) / 100;
      const due = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

      const { data: doc, error: docErr } = await sb.from("cmr_documents").insert({
        tenant_id: plan.tenant_id, doc_type: "rechnung", doc_number: nr, status: "entwurf",
        customer_id: plan.customer_id, customer_name: plan.customer_name, customer_email: plan.customer_email,
        doc_date: today, due_date: due, currency: plan.currency, tax_rate: taxRate,
        net_total: net, tax_total: tax, gross_total: net + tax, paid_total: 0,
        reference: `Sammelrechnung ${plan.name}`,
      }).select("id,doc_number").single();
      if (docErr) { results.push({ plan: plan.id, error: docErr.message }); continue; }

      await sb.from("cmr_document_items").insert(items.map((it) => ({ ...it, document_id: doc.id })));
      await sb.from("cmr_time_entries").update({
        billed_document_id: doc.id, billed_at: new Date().toISOString(),
      }).in("id", entries.map((e: any) => e.id));

      await sb.from("cmr_collective_plans").update({
        last_run_at: new Date().toISOString(),
        next_run_date: nextDate(plan.next_run_date <= today ? today : plan.next_run_date, plan.interval_unit),
      }).eq("id", plan.id);

      if (plan.auto_send && plan.customer_email) {
        try {
          await sb.functions.invoke("cmr-send-document", { body: { documentId: doc.id } });
        } catch (e) {
          console.error("auto send failed", e);
        }
      }

      created++;
      results.push({ plan: plan.id, document: doc.doc_number, entries: entries.length, net });
    }

    return Response.json({ ok: true, created, results }, { headers: corsHeaders });
  } catch (e) {
    console.error("cmr-collective-run failed:", e);
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500, headers: corsHeaders });
  }
});
