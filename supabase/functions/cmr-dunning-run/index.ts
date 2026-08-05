// CMR – Mahnlauf: erzeugt Zahlungserinnerungen / Mahnungen als ENTWÜRFE.
// Rein additiv: betrifft ausschließlich den Mandanten CMR. Kein automatischer Versand.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Stufe -> Belegart, Mindest-Verzugstage und Mindestabstand zur letzten Mahnung
const LEVELS = [
  { level: 1, type: "zahlungserinnerung", label: "Zahlungserinnerung", minOverdue: 3, minGapDays: 0 },
  { level: 2, type: "mahnung", label: "1. Mahnung", minOverdue: 10, minGapDays: 7 },
  { level: 3, type: "mahnung", label: "2. Mahnung", minOverdue: 20, minGapDays: 7 },
];

const days = (ms: number) => Math.floor(ms / 86400000);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId: string | null = body?.tenantId ?? null;

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const today = new Date().toISOString().slice(0, 10);

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
      const open = Number(d.gross_total || 0) - Number(d.paid_total || 0);
      if (open <= 0.01) continue;

      const overdue = d.due_date ? days(Date.now() - new Date(d.due_date).getTime()) : 0;
      const nextLevel = Math.min(3, Number(d.reminder_level || 0) + 1);
      if (Number(d.reminder_level || 0) >= 3) continue;

      const cfg = LEVELS.find((l) => l.level === nextLevel)!;
      if (overdue < cfg.minOverdue) continue;

      if (d.last_reminded_at) {
        const gap = days(Date.now() - new Date(d.last_reminded_at).getTime());
        if (gap < cfg.minGapDays) continue;
      }

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
        notes: `${cfg.label} zur Rechnung ${d.doc_number ?? ""} · offen seit ${overdue} Tagen.`,
      }).select("id").single();
      if (docErr) { results.push({ invoice: d.id, error: docErr.message }); continue; }

      const { error: liErr } = await sb.from("cmr_document_items").insert({
        document_id: doc.id,
        position: 1,
        name: `Offener Betrag Rechnung ${d.doc_number ?? ""}`,
        quantity: 1,
        unit: "Pauschal",
        unit_price: open,
        discount_pct: 0,
        tax_rate: 0,
        line_total: open,
      });
      if (liErr) { results.push({ invoice: d.id, error: liErr.message }); continue; }

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
