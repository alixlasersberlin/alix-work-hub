import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * CMR Bankabgleich: ordnet offene Bankpositionen automatisch offenen Rechnungen zu.
 * Reihenfolge der Treffer: Belegnummer im Verwendungszweck > eindeutiger Betragstreffer.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const tenantId: string | null = body?.tenantId ?? null;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    let lq = sb.from("cmr_bank_lines").select("*").eq("status", "offen").limit(1000);
    if (tenantId) lq = lq.eq("tenant_id", tenantId);
    const { data: lines, error: lErr } = await lq;
    if (lErr) throw lErr;

    let dq = sb.from("cmr_documents").select("*").neq("status", "storniert").limit(5000);
    if (tenantId) dq = dq.eq("tenant_id", tenantId);
    const { data: docs, error: dErr } = await dq;
    if (dErr) throw dErr;

    const openDocs = (docs ?? []).filter(
      (d: any) => d.doc_type !== "gutschrift" && Number(d.gross_total || 0) - Number(d.paid_total || 0) > 0.01,
    );

    let matched = 0;
    const results: any[] = [];

    for (const l of lines ?? []) {
      const amount = Number(l.amount || 0);
      if (amount <= 0) continue;
      const purpose = String(l.purpose ?? "").toUpperCase();
      const candidates = openDocs.filter((d: any) => d.tenant_id === l.tenant_id);

      let hit = candidates.find(
        (d: any) => d.doc_number && purpose.includes(String(d.doc_number).toUpperCase()),
      );
      let score = hit ? 1 : 0;

      if (!hit) {
        const exact = candidates.filter(
          (d: any) => Math.abs(Number(d.gross_total || 0) - Number(d.paid_total || 0) - amount) < 0.01,
        );
        if (exact.length === 1) { hit = exact[0]; score = 0.8; }
      }
      if (!hit) continue;

      const { data: pay, error: pErr } = await sb.from("cmr_payments").insert({
        tenant_id: l.tenant_id,
        document_id: hit.id,
        customer_id: hit.customer_id,
        paid_on: l.booking_date ?? new Date().toISOString().slice(0, 10),
        amount,
        currency: l.currency ?? hit.currency,
        method: "Auto-Bankabgleich",
        reference: String(l.purpose ?? "").slice(0, 200) || null,
      }).select("id").single();
      if (pErr) { results.push({ line: l.id, error: pErr.message }); continue; }

      await sb.from("cmr_bank_lines").update({
        status: "gebucht",
        matched_document_id: hit.id,
        payment_id: pay?.id ?? null,
        match_score: score,
        matched_at: new Date().toISOString(),
      }).eq("id", l.id);

      hit.paid_total = Number(hit.paid_total || 0) + amount;
      matched++;
      results.push({ line: l.id, document: hit.doc_number, amount, score });
    }

    return Response.json({ ok: true, checked: lines?.length ?? 0, matched, results }, { headers: corsHeaders });
  } catch (e) {
    console.error("cmr-bank-automatch failed:", e);
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500, headers: corsHeaders });
  }
});
