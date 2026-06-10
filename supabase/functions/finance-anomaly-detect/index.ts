// Phase 10 – Anomalie-Erkennung (statistisch, ohne KI). Cron 04:00 UTC.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function median(arr: number[]) { if (!arr.length) return 0; const s = [...arr].sort((a,b)=>a-b); const m = Math.floor(s.length/2); return s.length%2 ? s[m] : (s[m-1]+s[m])/2; }
function mad(arr: number[], med: number) { return median(arr.map(v => Math.abs(v - med))) || 1; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
  const since = new Date(); since.setDate(since.getDate() - 90);
  const sinceIso = since.toISOString().slice(0, 10);

  let created = 0;

  // ===== Transactions =====
  const { data: tx } = await supa.from("finance_transactions")
    .select("id, amount, transaction_type, booking_date, customer_id, order_id")
    .gte("booking_date", sinceIso)
    .limit(5000);

  const groups = new Map<string, { id: string; amount: number }[]>();
  for (const r of tx ?? []) {
    const k = (r.transaction_type || "unknown").toLowerCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push({ id: r.id, amount: Math.abs(Number(r.amount) || 0) });
  }
  const anomalies: any[] = [];
  for (const [cat, items] of groups) {
    if (items.length < 8) continue;
    const vals = items.map(i => i.amount);
    const med = median(vals);
    const m = mad(vals, med);
    for (const it of items) {
      const z = m ? (Math.abs(it.amount - med) / (1.4826 * m)) : 0;
      if (z > 3 && it.amount > 100) {
        anomalies.push({
          source_type: "transaction", source_id: it.id, category: cat, amount: it.amount,
          reason: "zscore_outlier", severity: z > 5 ? "high" : "medium",
          description: `Ausreißer in Kategorie "${cat}": ${it.amount.toFixed(2)} EUR (z≈${z.toFixed(1)} vs. Median ${med.toFixed(2)})`,
          meta: { zscore: z, median: med },
        });
      }
      if (it.amount >= 10000 && it.amount % 1000 === 0) {
        anomalies.push({
          source_type: "transaction", source_id: it.id, category: cat, amount: it.amount,
          reason: "round_large_amount", severity: "low",
          description: `Auffällig runder Betrag ${it.amount.toFixed(2)} EUR`,
        });
      }
    }
  }

  // ===== Incoming Invoices: duplicate suspects =====
  const { data: inv } = await supa.from("finance_incoming_invoices")
    .select("id, supplier_id, invoice_date, amount_gross, description")
    .gte("invoice_date", sinceIso)
    .limit(5000);
  const seen = new Map<string, string>();
  for (const r of inv ?? []) {
    const k = `${r.supplier_id ?? "x"}|${r.invoice_date}|${Number(r.amount_gross || 0).toFixed(2)}`;
    if (seen.has(k)) {
      anomalies.push({
        source_type: "incoming_invoice", source_id: r.id, amount: Number(r.amount_gross) || 0,
        reason: "duplicate_suspect", severity: "high",
        description: `Möglicher Duplikat (gleicher Lieferant/Datum/Betrag wie ${seen.get(k)})`,
        meta: { duplicate_of: seen.get(k) },
      });
    } else seen.set(k, r.id);
  }

  for (const a of anomalies) {
    const { error } = await supa.from("finance_anomalies").insert(a);
    if (!error) created++;
  }

  return new Response(JSON.stringify({ ok: true, scanned_tx: (tx ?? []).length, scanned_inv: (inv ?? []).length, created }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
