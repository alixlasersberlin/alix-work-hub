import "../_shared/global-bcc.ts";
// CMR – Mahnlauf: erzeugt Zahlungserinnerungen / Mahnungen als Entwürfe.
// Ist in den CMR-Einstellungen "dunning_auto_send" aktiv, werden sie zusätzlich per E-Mail versendet.
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

// Stufe -> Belegart; Fristen, Gebühren und Zinsen kommen aus cmr_settings (Fallbacks unten)
const DEFAULTS = {
  dunning_days_1: 3, dunning_days_2: 10, dunning_days_3: 20, dunning_gap_days: 7,
  dunning_fee_1: 0, dunning_fee_2: 0, dunning_fee_3: 0, dunning_interest_pct: 0,
};

type Cfg = typeof DEFAULTS;

function levelConfig(cfg: Cfg, level: number) {
  if (level === 1) return { type: "zahlungserinnerung", label: "Zahlungserinnerung", minOverdue: cfg.dunning_days_1, minGapDays: 0, fee: cfg.dunning_fee_1 };
  if (level === 2) return { type: "mahnung", label: "1. Mahnung", minOverdue: cfg.dunning_days_2, minGapDays: cfg.dunning_gap_days, fee: cfg.dunning_fee_2 };
  return { type: "mahnung", label: "2. Mahnung", minOverdue: cfg.dunning_days_3, minGapDays: cfg.dunning_gap_days, fee: cfg.dunning_fee_3 };
}

const days = (ms: number) => Math.floor(ms / 86400000);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId: string | null = body?.tenantId ?? null;

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const today = new Date().toISOString().slice(0, 10);

    // Mahnstufen-Konfiguration je Mandant laden
    const { data: settingsRows } = await sb.from("cmr_settings").select("*");
    const cfgByTenant = new Map<string, Cfg>();
    const settingsByTenant = new Map<string, any>();
    for (const s of settingsRows ?? []) {
      const c: Cfg = { ...DEFAULTS };
      for (const k of Object.keys(DEFAULTS) as (keyof Cfg)[]) {
        if (s[k] !== null && s[k] !== undefined) c[k] = Number(s[k]);
      }
      cfgByTenant.set(s.tenant_id, c);
      settingsByTenant.set(s.tenant_id, s);
    }

    // Individuelle Mahnstufen je Kunde (überschreiben die Mandanteneinstellung)
    const { data: overrideRows } = await sb.from("cmr_customer_dunning").select("*");
    const overrides = new Map<string, any>();
    for (const o of overrideRows ?? []) overrides.set(`${o.tenant_id}:${o.customer_id}`, o);

    let q = sb.from("cmr_documents").select("*")
      .eq("doc_type", "rechnung")
      .lt("due_date", today)
      .not("status", "in", '("storniert","abgeschlossen")')
      .limit(500);
    if (tenantId) q = q.eq("tenant_id", tenantId);

    const { data: invoices, error } = await q;
    if (error) throw error;

    let created = 0;
    const results: unknown[] = [];

    for (const d of invoices ?? []) {
      const openBase = Number(d.gross_total || 0) - Number(d.paid_total || 0);
      if (openBase <= 0.01) continue;

      const overdue = d.due_date ? days(Date.now() - new Date(d.due_date).getTime()) : 0;
      const nextLevel = Math.min(3, Number(d.reminder_level || 0) + 1);
      if (Number(d.reminder_level || 0) >= 3) continue;

      const ovr = d.customer_id ? overrides.get(`${d.tenant_id}:${d.customer_id}`) : null;
      if (ovr && ovr.is_active === false) continue; // Kunde vom Mahnlauf ausgenommen

      const baseCfg = cfgByTenant.get(d.tenant_id) ?? DEFAULTS;
      const tCfg: Cfg = ovr
        ? {
          dunning_days_1: Number(ovr.days_1 ?? baseCfg.dunning_days_1),
          dunning_days_2: Number(ovr.days_2 ?? baseCfg.dunning_days_2),
          dunning_days_3: Number(ovr.days_3 ?? baseCfg.dunning_days_3),
          dunning_gap_days: Number(ovr.gap_days ?? baseCfg.dunning_gap_days),
          dunning_fee_1: Number(ovr.fee_1 ?? baseCfg.dunning_fee_1),
          dunning_fee_2: Number(ovr.fee_2 ?? baseCfg.dunning_fee_2),
          dunning_fee_3: Number(ovr.fee_3 ?? baseCfg.dunning_fee_3),
          dunning_interest_pct: Number(ovr.interest_pct ?? baseCfg.dunning_interest_pct),
        }
        : baseCfg;
      const cfg = levelConfig(tCfg, nextLevel);
      if (overdue < cfg.minOverdue) continue;

      if (d.last_reminded_at) {
        const gap = days(Date.now() - new Date(d.last_reminded_at).getTime());
        if (gap < cfg.minGapDays) continue;
      }

      const interest = tCfg.dunning_interest_pct > 0
        ? Math.round(openBase * (tCfg.dunning_interest_pct / 100) * (overdue / 365) * 100) / 100
        : 0;
      const fee = Number(cfg.fee || 0);
      const open = Math.round((openBase + fee + interest) * 100) / 100;


      const { data: nr, error: nrErr } = await sb.rpc("cmr_next_document_number", {
        _tenant_id: d.tenant_id,
        _doc_type: cfg.type,
      });
      if (nrErr) { results.push({ invoice: d.id, error: nrErr.message }); continue; }

      const { data: doc, error: docErr } = await sb.from("cmr_documents").insert({
        tenant_id: d.tenant_id,
        doc_type: cfg.type,
        doc_number: nr,
        status: "entwurf",
        customer_id: d.customer_id,
        customer_name: d.customer_name,
        customer_email: d.customer_email,
        billing_address: d.billing_address,
        doc_date: today,
        due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        currency: d.currency,
        tax_rate: 0,
        net_total: open,
        tax_total: 0,
        gross_total: open,
        paid_total: 0,
        reference: d.doc_number,
        parent_document_id: d.id,
        notes: `${cfg.label} zur Rechnung ${d.doc_number ?? ""} · offen seit ${overdue} Tagen.`
          + (fee ? ` · Mahngebühr ${fee.toFixed(2)}` : "")
          + (interest ? ` · Verzugszinsen ${interest.toFixed(2)}` : ""),
      }).select("id").single();
      if (docErr) { results.push({ invoice: d.id, error: docErr.message }); continue; }

      const posRows: Record<string, unknown>[] = [{
        document_id: doc.id,
        position: 1,
        name: `Offener Betrag Rechnung ${d.doc_number ?? ""}`,
        quantity: 1,
        unit: "Pauschal",
        unit_price: openBase,
        discount_pct: 0,
        tax_rate: 0,
        line_total: openBase,
      }];
      if (fee) posRows.push({ document_id: doc.id, position: 2, name: "Mahngebühr", quantity: 1, unit: "Pauschal", unit_price: fee, discount_pct: 0, tax_rate: 0, line_total: fee });
      if (interest) posRows.push({ document_id: doc.id, position: posRows.length + 1, name: `Verzugszinsen (${tCfg.dunning_interest_pct}% p.a.)`, quantity: 1, unit: "Pauschal", unit_price: interest, discount_pct: 0, tax_rate: 0, line_total: interest });

      const { error: liErr } = await sb.from("cmr_document_items").insert(posRows);
      if (liErr) { results.push({ invoice: d.id, error: liErr.message }); continue; }


      // Optionaler automatischer Versand
      const tSettings = settingsByTenant.get(d.tenant_id);
      if (tSettings?.dunning_auto_send && d.customer_email && RESEND_API_KEY) {
        const subject = `${cfg.label} ${nr} – ${tSettings.company_name ?? "CMR"}`;
        const text = `Sehr geehrte Damen und Herren,\n\nzur Rechnung ${d.doc_number ?? ""} ist ein Betrag von ${open.toFixed(2)} ${d.currency ?? ""} seit ${overdue} Tagen offen.\nBitte begleichen Sie den Betrag kurzfristig.\n\nMit freundlichen Grüßen\n${tSettings.company_name ?? "CMR"}`;
        let status = "gesendet";
        let errText: string | null = null;
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: tSettings.email ? `${tSettings.company_name ?? "CMR"} <${tSettings.email}>` : "CMR <onboarding@resend.dev>",
              to: [d.customer_email],
              bcc: ["k.trinh@alix-operation.de"],
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
          tenant_id: d.tenant_id, document_id: doc.id, recipients: d.customer_email,
          subject, provider: "resend", status, error: errText,
        });
        if (status === "gesendet") {
          await sb.from("cmr_documents").update({ status: "versendet", sent_at: new Date().toISOString() }).eq("id", doc.id);
        }
      }

      await sb.from("cmr_documents").update({
        reminder_level: nextLevel,
        last_reminded_at: new Date().toISOString(),
      }).eq("id", d.id);

      created++;
      results.push({ invoice: d.id, document: doc.id, number: nr, level: nextLevel });
    }

    return Response.json({ ok: true, created, results }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500, headers: corsHeaders });
  }
});