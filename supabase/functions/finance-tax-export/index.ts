// Phase 14 – Steuer & Meldewesen Export
// Erzeugt UStVA / ZM / OSS / Intrastat / E-Bilanz Meldungen aus finance_transactions.
// Persistiert finance_tax_filings + finance_tax_filing_lines + export_content.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const BodySchema = z.object({
  filing_type: z.enum(["ustva", "zm", "oss", "intrastat", "ebilanz"]),
  period_value: z.string().min(4).max(20),
  tenant_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).optional(),
});

function periodToRange(period: string): { from: string; to: string; year: number } {
  // 2026-03  (monthly)
  let m = period.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]); const mo = Number(m[2]);
    const from = `${m[1]}-${m[2]}-01`;
    const to = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
    return { from, to, year: y };
  }
  // 2026-Q1
  m = period.match(/^(\d{4})-Q([1-4])$/);
  if (m) {
    const y = Number(m[1]); const q = Number(m[2]);
    const fm = (q - 1) * 3 + 1; const tm = q * 3;
    const from = `${y}-${String(fm).padStart(2, "0")}-01`;
    const to = new Date(Date.UTC(y, tm, 0)).toISOString().slice(0, 10);
    return { from, to, year: y };
  }
  // 2026
  m = period.match(/^(\d{4})$/);
  if (m) {
    const y = Number(m[1]);
    return { from: `${y}-01-01`, to: `${y}-12-31`, year: y };
  }
  throw new Error("invalid period format (use YYYY-MM, YYYY-Qn or YYYY)");
}

function csvLine(parts: (string | number)[]) {
  return parts.map((p) => {
    const s = String(p ?? "");
    return s.includes(";") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(";");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: roleRows } = await admin
    .from("user_roles").select("roles(name)").eq("user_id", user.id);
  const roles = (roleRows ?? []).map((r: any) => r?.roles?.name).filter(Boolean);
  const allowed = roles.some((r: string) =>
    ["Super Admin", "Admin", "Geschäftsführung", "Finance"].includes(r));
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { filing_type, period_value, tenant_id, notes } = parsed.data;
  let range; try { range = periodToRange(period_value); } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let txq = admin.from("finance_transactions")
      .select("amount, currency, transaction_type, booking_date, tenant_id, counterparty_tenant_id, reference")
      .gte("booking_date", range.from).lte("booking_date", range.to).limit(50000);
    if (tenant_id) txq = txq.eq("tenant_id", tenant_id);
    const { data: txs, error: txErr } = await txq;
    if (txErr) throw txErr;

    const lines: any[] = [];
    let exportFormat = "txt"; let exportContent = "";
    let total = 0;

    if (filing_type === "ustva") {
      // simplified UStVA: revenue 19%, 7%, intra-EU, reverse-charge
      const buckets: Record<string, { base: number; tax: number; rate: number; label: string }> = {
        "81": { base: 0, tax: 0, rate: 19, label: "Umsätze 19%" },
        "86": { base: 0, tax: 0, rate: 7, label: "Umsätze 7%" },
        "41": { base: 0, tax: 0, rate: 0, label: "Innergemeinschaftliche Lieferungen" },
        "66": { base: 0, tax: 0, rate: 0, label: "Vorsteuer" },
      };
      for (const tx of txs ?? []) {
        const amt = Number(tx.amount ?? 0);
        if (tx.transaction_type === "Rechnung" || tx.transaction_type === "Verkauf") {
          buckets["81"].base += amt;
          buckets["81"].tax += amt * 0.19;
        } else if (tx.transaction_type === "Eingangsrechnung" || tx.transaction_type === "Ausgabe") {
          buckets["66"].tax += amt * 0.19;
        }
      }
      for (const [code, b] of Object.entries(buckets)) {
        lines.push({ line_code: code, line_label: b.label, base_amount: b.base, amount: b.tax, tax_rate: b.rate });
      }
      total = buckets["81"].tax + buckets["86"].tax - buckets["66"].tax;
      exportFormat = "xml";
      exportContent = `<?xml version="1.0" encoding="UTF-8"?>
<Elster>
  <UStVA Zeitraum="${period_value}">
    ${lines.map((l) => `<Kennzahl nr="${l.line_code}" basis="${l.base_amount.toFixed(2)}" steuer="${l.amount.toFixed(2)}"/>`).join("\n    ")}
    <Zahllast>${total.toFixed(2)}</Zahllast>
  </UStVA>
</Elster>`;
    } else if (filing_type === "zm") {
      // ZM: per counterparty (proxy via tenant_id / reference)
      const map = new Map<string, number>();
      for (const tx of txs ?? []) {
        if (tx.counterparty_tenant_id) {
          map.set(tx.counterparty_tenant_id, (map.get(tx.counterparty_tenant_id) ?? 0) + Number(tx.amount ?? 0));
        }
      }
      for (const [k, v] of map.entries()) {
        lines.push({ line_code: "ZM", line_label: "i.g. Lieferung", country_code: "DE", vat_id: k, amount: v });
        total += v;
      }
      exportFormat = "csv";
      exportContent = ["LandUStId;Betrag", ...lines.map((l) => csvLine([l.vat_id, l.amount.toFixed(2)]))].join("\n");
    } else if (filing_type === "oss") {
      // OSS: revenue per country (heuristic by reference prefix)
      const map = new Map<string, number>();
      for (const tx of txs ?? []) {
        const ccMatch = (tx.reference ?? "").match(/^([A-Z]{2})/);
        const cc = ccMatch?.[1] ?? "DE";
        map.set(cc, (map.get(cc) ?? 0) + Number(tx.amount ?? 0));
      }
      for (const [cc, v] of map.entries()) {
        const tax = v * 0.19;
        lines.push({ line_code: "OSS", line_label: `Umsatz ${cc}`, country_code: cc, base_amount: v, amount: tax, tax_rate: 19 });
        total += tax;
      }
      exportFormat = "csv";
      exportContent = ["Land;Basis;Steuer", ...lines.map((l) => csvLine([l.country_code, l.base_amount.toFixed(2), l.amount.toFixed(2)]))].join("\n");
    } else if (filing_type === "intrastat") {
      lines.push({ line_code: "INTRA-V", line_label: "Versendungen", amount: 0, base_amount: 0 });
      lines.push({ line_code: "INTRA-E", line_label: "Eingänge", amount: 0, base_amount: 0 });
      exportFormat = "csv";
      exportContent = "Hinweis;Intrastat-Erstellung erfordert Warenstrom-Daten – Platzhalterdatei erzeugt.\n";
    } else if (filing_type === "ebilanz") {
      let revenue = 0; let expense = 0;
      for (const tx of txs ?? []) {
        const amt = Number(tx.amount ?? 0);
        if (tx.transaction_type === "Rechnung" || tx.transaction_type === "Verkauf") revenue += amt;
        else if (tx.transaction_type === "Eingangsrechnung" || tx.transaction_type === "Ausgabe") expense += amt;
      }
      lines.push({ line_code: "REVENUE", line_label: "Umsatzerlöse", amount: revenue });
      lines.push({ line_code: "EXPENSE", line_label: "Aufwendungen", amount: expense });
      total = revenue - expense;
      lines.push({ line_code: "RESULT", line_label: "Jahresergebnis", amount: total });
      exportFormat = "xml";
      exportContent = `<?xml version="1.0" encoding="UTF-8"?>
<EBilanz Jahr="${range.year}">
  <Umsatz>${revenue.toFixed(2)}</Umsatz>
  <Aufwand>${expense.toFixed(2)}</Aufwand>
  <Ergebnis>${total.toFixed(2)}</Ergebnis>
</EBilanz>`;
    }

    // Upsert filing (replace existing for same tenant+type+period)
    await admin.from("finance_tax_filings").delete()
      .eq("filing_type", filing_type).eq("period_value", period_value)
      .filter("tenant_id", tenant_id ? "eq" : "is", tenant_id ?? null);

    const { data: fil, error: filErr } = await admin.from("finance_tax_filings").insert({
      tenant_id: tenant_id ?? null,
      filing_type,
      period_year: range.year,
      period_value,
      status: "prepared",
      total_amount: total,
      currency: "EUR",
      payload: { lines },
      export_format: exportFormat,
      export_content: exportContent,
      prepared_by: user.id,
      prepared_at: new Date().toISOString(),
      notes: notes ?? null,
    }).select("id").single();
    if (filErr) throw filErr;

    if (lines.length) {
      await admin.from("finance_tax_filing_lines").insert(
        lines.map((l) => ({ ...l, filing_id: (fil as any).id })),
      );
    }

    return new Response(JSON.stringify({
      ok: true, filing_id: (fil as any).id, total, lines: lines.length, format: exportFormat,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("tax-export error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
