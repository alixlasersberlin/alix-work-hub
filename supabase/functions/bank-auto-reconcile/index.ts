import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

function payerKey(tx: any): string | null {
  const iban = norm(tx.sender_receiver_iban);
  if (iban.length >= 10) return `iban:${iban}`;
  const name = norm(tx.sender_receiver_name);
  if (name.length >= 4) return `name:${name}`;
  return null;
}

/** Bewertet eine Bankbuchung gegen offene Rechnungen (Spiegel von src/lib/bank/matching.ts). */
function scoreInvoices(tx: any, invoices: any[], learnedCustomerId?: string | null) {
  const hay = norm(
    `${tx.purpose ?? ""} ${tx.booking_text ?? ""} ${tx.end_to_end_reference ?? ""} ${tx.customer_reference ?? ""} ${tx.bank_reference ?? ""}`,
  );
  const payer = norm(tx.sender_receiver_name);
  const abs = Math.abs(Number(tx.amount));
  const results: { invoice: any; score: number; reasons: string[] }[] = [];

  for (const inv of invoices) {
    if (inv.currency && tx.currency && String(inv.currency).toUpperCase() !== String(tx.currency).toUpperCase()) continue;
    let score = 0;
    const reasons: string[] = [];
    const numN = norm(inv.invoice_number);

    if (numN && numN.length >= 4 && hay.includes(numN)) {
      score += 55; reasons.push(`Rechnungsnummer ${inv.invoice_number} im Verwendungszweck`);
    } else if (numN.length >= 5 && hay.includes(numN.slice(-5))) {
      score += 25; reasons.push("Teil der Rechnungsnummer erkannt");
    }
    if (inv.reference_number && norm(inv.reference_number).length >= 4 && hay.includes(norm(inv.reference_number))) {
      score += 20; reasons.push(`Referenznummer ${inv.reference_number} erkannt`);
    }

    const bal = Number(inv.balance ?? 0);
    const total = Number(inv.total ?? 0);
    if (bal > 0 && Math.abs(bal - abs) < 0.01) { score += 30; reasons.push("Offener Betrag stimmt exakt überein"); }
    else if (total > 0 && Math.abs(total - abs) < 0.01) { score += 22; reasons.push("Rechnungsbetrag stimmt exakt überein"); }
    else if (bal > 0 && abs < bal) { score += 6; reasons.push("Teilzahlung möglich"); }
    else if (bal > 0 && abs > bal) { score += 3; reasons.push("Überzahlung möglich"); }

    const cname = norm(inv.customer_name);
    if (cname && payer) {
      if (cname === payer) { score += 20; reasons.push("Kundenname stimmt überein"); }
      else if (cname.length > 4 && (payer.includes(cname) || cname.includes(payer))) { score += 14; reasons.push("Kundenname ähnlich"); }
    }
    if (cname && cname.length > 4 && hay.includes(cname)) { score += 8; reasons.push("Kundenname im Buchungstext"); }
    if (learnedCustomerId && inv.customer_id && inv.customer_id === learnedCustomerId) {
      score += 18; reasons.push("Gelernte Regel: Zahler war bereits diesem Kunden zugeordnet");
    }
    if (score > 0) results.push({ invoice: inv, score: Math.min(100, score), reasons });
  }

  results.sort((a, b) => b.score - a.score);
  const exact = results.filter((r) => Math.abs(Number(r.invoice.balance ?? 0) - abs) < 0.01);
  if (exact.length === 1 && exact[0].score < 95) {
    exact[0].score = Math.min(100, exact[0].score + 10);
    exact[0].reasons.push("Betrag ist eindeutig");
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 5);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const areas: ("EU" | "CH")[] = body?.area ? [body.area] : ["EU", "CH"];
  const summary: Record<string, unknown>[] = [];

  try {
    for (const area of areas) {
      const { data: txs } = await sb
        .from("bank_transactions")
        .select("*")
        .eq("accounting_area", area)
        .eq("status", "offen")
        .eq("is_duplicate", false)
        .eq("is_return_debit", false)
        .order("booking_date", { ascending: false })
        .limit(500);

      const list = txs ?? [];
      if (!list.length) { summary.push({ area, geprueft: 0, vorschlaege: 0, verbucht: 0 }); continue; }

      const invCols =
        "id,invoice_number,reference_number,customer_id,customer_name,invoice_date,due_date,currency,total,balance,status,payment_status";
      const [stdRes, recRes] = await Promise.all([
        sb.from("zoho_invoices").select(invCols).eq("accounting_region", area).gt("balance", 0)
          .order("invoice_date", { ascending: false }).limit(3000),
        sb.from("zoho_recurring_invoices").select(invCols).eq("accounting_region", area).gt("balance", 0)
          .order("invoice_date", { ascending: false }).limit(3000),
      ]);

      const invoices = [
        ...((stdRes.data ?? []) as any[]).map((i) => ({ ...i, __table: "zoho_invoices" })),
        ...((recRes.data ?? []) as any[]).map((i) => ({ ...i, __table: "zoho_recurring_invoices" })),
      ];

      const open = invoices.filter(
        (i: any) => !["void", "cancelled", "storniert"].includes(String(i.status ?? "").toLowerCase()),
      );


      const { data: rulesRows } = await sb.from("bank_match_rules").select("*").eq("accounting_area", area).limit(2000);
      const rules = new Map<string, any>();
      for (const r of rulesRows ?? []) rules.set((r as any).payer_key, r);

      const { data: accounts } = await sb.from("bank_accounts").select("*").eq("accounting_area", area);
      const accMap = new Map<string, any>();
      for (const a of accounts ?? []) accMap.set((a as any).id, a);

      let vorschlaege = 0;
      let verbucht = 0;

      for (const tx of list as any[]) {
        const key = payerKey(tx);
        const rule = key ? rules.get(key) : null;
        const cands = scoreInvoices(tx, open, rule?.customer_id ?? null);
        if (!cands.length) continue;

        await sb.from("bank_transaction_matches").delete().eq("bank_transaction_id", tx.id).eq("status", "vorschlag");
        await sb.from("bank_transaction_matches").insert(
          cands.map((c) => ({
            bank_transaction_id: tx.id,
            customer_id: null,
            invoice_id: c.invoice.id,
            invoice_number: c.invoice.invoice_number,
            suggested_amount: Math.min(Math.abs(Number(tx.amount)), Number(c.invoice.balance ?? 0)),
            matching_score: Math.round(c.score),
            matching_reasons: c.reasons,
            status: "vorschlag",
          })) as any,
        );
        vorschlaege++;

        const best = cands[0];
        await sb.from("bank_transactions").update({ matching_score: Math.round(best.score) } as any).eq("id", tx.id);

        // Automatische Verbuchung nur bei sehr sicheren Treffern
        const acc = accMap.get(tx.bank_account_id);
        const threshold = Number(acc?.auto_book_threshold ?? 95);
        const allowAuto = Boolean(acc?.automatic_booking_enabled) || Boolean(rule?.auto_book);
        const amount = Math.abs(Number(tx.amount));
        const balance = Number(best.invoice.balance ?? 0);
        const exact = Math.abs(balance - amount) < 0.01;

        if (allowAuto && exact && best.score >= threshold && tx.transaction_type !== "ausgang") {
          await sb.from("bank_transaction_allocations").insert({
            bank_transaction_id: tx.id,
            invoice_id: best.invoice.id,
            invoice_number: best.invoice.invoice_number,
            customer_id: null,
            allocation_type: "rechnung",
            allocated_amount: amount,
            currency: tx.currency,
            note: "Automatischer Tagesabgleich",
          } as any);
          await sb.from((best.invoice as any).__table ?? "zoho_invoices").update({
            balance: 0,
            payment_status: "paid",
            status: "paid",
            last_payment_date: tx.booking_date ?? new Date().toISOString().slice(0, 10),
          } as any).eq("id", best.invoice.id);
          await sb.from("bank_transactions").update({
            status: "verbucht",
            matched_invoice_id: best.invoice.id,
          } as any).eq("id", tx.id);
          await sb.from("bank_audit_log").insert({
            action: "buchung_auto_verbucht",
            bank_transaction_id: tx.id,
            new_value: { invoice_id: best.invoice.id, score: best.score, amount },
            user_email: "system:bank-auto-reconcile",
          } as any);
          best.invoice.balance = 0;
          verbucht++;
        }
      }

      summary.push({ area, geprueft: list.length, vorschlaege, verbucht });
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
