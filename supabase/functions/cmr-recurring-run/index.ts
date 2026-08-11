import "../_shared/global-bcc.ts";
// CMR – Wiederkehrende Abrechnung: erzeugt fällige Rechnungen aus cmr_recurring_plans.
// Rein additiv: betrifft ausschließlich den Mandanten CMR.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

function advance(dateStr: string, unit: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  if (unit === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else if (unit === "quarterly") d.setUTCMonth(d.getUTCMonth() + 3);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const planId: string | null = body?.planId ?? null;
    const tenantId: string | null = body?.tenantId ?? null;

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const today = new Date().toISOString().slice(0, 10);

    let q = sb.from("cmr_recurring_plans").select("*").eq("is_active", true);
    if (planId) q = q.eq("id", planId);
    else q = q.lte("next_run_date", today);
    if (tenantId) q = q.eq("tenant_id", tenantId);

    const { data: plans, error } = await q;
    if (error) throw error;

    // --- Zahlungsavis: Kunden vor der nächsten Abrechnung vorab informieren ---
    const { data: settingsRows } = await sb.from("cmr_settings").select("*");
    const settingsByTenant = new Map<string, any>();
    for (const st of settingsRows ?? []) settingsByTenant.set(st.tenant_id, st);

    const { data: noticeRows } = await sb
      .from("cmr_customer_dunning")
      .select("tenant_id,customer_id,advance_notice_active,advance_notice_days");
    const noticeOverrides = new Map<string, any>();
    for (const n of noticeRows ?? []) noticeOverrides.set(`${n.tenant_id}:${n.customer_id}`, n);

    let notices = 0;
    if (!planId && RESEND_API_KEY) {
      let nq = sb.from("cmr_recurring_plans").select("*").eq("is_active", true).gt("next_run_date", today);
      if (tenantId) nq = nq.eq("tenant_id", tenantId);
      const { data: upcoming } = await nq;
      for (const p of upcoming ?? []) {
        const st = settingsByTenant.get(p.tenant_id);
        if (!p.customer_email) continue;

        // Reihenfolge: Abo-Einstellung > Kundeneinstellung > Mandanteneinstellung
        const ovr = p.customer_id ? noticeOverrides.get(`${p.tenant_id}:${p.customer_id}`) : null;
        const active = p.advance_notice_active ?? ovr?.advance_notice_active ?? st?.advance_notice_active;
        if (!active) continue;
        const lead = Number(p.advance_notice_days ?? ovr?.advance_notice_days ?? st?.advance_notice_days ?? 5);
        const daysLeft = Math.ceil(
          (new Date(p.next_run_date + "T00:00:00Z").getTime() - new Date(today + "T00:00:00Z").getTime()) / 86400000,
        );
        if (daysLeft > lead) continue;
        // pro Abrechnungszyklus nur einmal avisieren
        if (p.last_notice_at && new Date(p.last_notice_at).getTime() > Date.now() - (daysLeft + lead) * 86400000) continue;

        const lines = Array.isArray(p.lines) ? p.lines : [];
        const gross = lines.reduce((s: number, l: any) => {
          const t = Number(l.quantity || 0) * Number(l.unit_price || 0);
          return s + t + t * (Number(l.tax_rate || 0) / 100);
        }, 0);
        const subject = `Zahlungsavis: Ihre Rechnung vom ${new Date(p.next_run_date).toLocaleDateString("de-DE")}`;
        const text = `Sehr geehrte Damen und Herren,\n\nwir informieren Sie vorab: am ${new Date(p.next_run_date).toLocaleDateString("de-DE")} stellen wir Ihnen `
          + `${gross.toFixed(2)} ${p.currency ?? ""} für "${p.name}" in Rechnung.\n\nMit freundlichen Grüßen\n${st.company_name ?? "CMR"}`;
        let status = "gesendet";
        let errText: string | null = null;
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: st.email ? `${st.company_name ?? "CMR"} <${st.email}>` : "CMR <onboarding@resend.dev>",
              to: [p.customer_email],
              subject,
              text,
            }),
          });
          if (!res.ok) { status = "fehler"; errText = await res.text(); }
        } catch (e) {
          status = "fehler";
          errText = String((e as Error)?.message || e);
        }
        await sb.from("cmr_email_log").insert({
          tenant_id: p.tenant_id, document_id: null, recipients: p.customer_email,
          subject, provider: "resend", status, error: errText,
        });
        if (status === "gesendet") {
          await sb.from("cmr_recurring_plans").update({ last_notice_at: new Date().toISOString() }).eq("id", p.id);
          notices++;
        }
      }
    }

    let created = 0;
    const results: unknown[] = [];

    for (const p of plans ?? []) {
      const lines = Array.isArray(p.lines) ? p.lines : [];
      if (!lines.length) continue;

      const { data: nr, error: nrErr } = await sb.rpc("cmr_next_document_number", {
        _tenant_id: p.tenant_id,
        _doc_type: "rechnung",
      });
      if (nrErr) { results.push({ plan: p.id, error: nrErr.message }); continue; }

      let net = 0;
      let tax = 0;
      const rows = lines.map((l: any, i: number) => {
        const total = Number(l.quantity || 0) * Number(l.unit_price || 0);
        net += total;
        tax += total * (Number(l.tax_rate || 0) / 100);
        return {
          position: i + 1,
          name: l.name,
          quantity: Number(l.quantity || 0),
          unit: l.unit || "Stück",
          unit_price: Number(l.unit_price || 0),
          discount_pct: 0,
          tax_rate: Number(l.tax_rate || 0),
          line_total: total,
        };
      });

      const docDate = today;
      const dueDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

      const { data: doc, error: docErr } = await sb.from("cmr_documents").insert({
        tenant_id: p.tenant_id,
        doc_type: "rechnung",
        doc_number: nr,
        status: "entwurf",
        customer_id: p.customer_id,
        customer_name: p.customer_name,
        customer_email: p.customer_email,
        billing_address: p.billing_address,
        doc_date: docDate,
        due_date: dueDate,
        currency: p.currency,
        tax_rate: p.tax_rate,
        net_total: net,
        tax_total: tax,
        gross_total: net + tax,
        paid_total: 0,
        reference: p.name,
        notes: p.notes,
      }).select("id").single();
      if (docErr) { results.push({ plan: p.id, error: docErr.message }); continue; }

      const { error: liErr } = await sb.from("cmr_document_items")
        .insert(rows.map((r) => ({ ...r, document_id: doc.id })));
      if (liErr) { results.push({ plan: p.id, error: liErr.message }); continue; }

      await sb.from("cmr_recurring_plans").update({
        next_run_date: advance(p.next_run_date, p.interval_unit),
        last_run_at: new Date().toISOString(),
      }).eq("id", p.id);

      created++;
      results.push({ plan: p.id, document: doc.id, number: nr });
    }

    return Response.json({ ok: true, created, notices, results }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500, headers: corsHeaders });
  }
});