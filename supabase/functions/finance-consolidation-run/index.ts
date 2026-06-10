// Phase 13 – Konzern-Konsolidierung
// Aggregiert finance_transactions je Mandant für eine Periode (Monat),
// rechnet Fremdwährungen über finance_fx_rates in EUR um,
// eliminiert Intercompany-Buchungen (counterparty_tenant_id gesetzt + Match vorhanden)
// und persistiert einen finance_consolidation_run + finance_consolidation_items.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const BodySchema = z.object({
  period_month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  notes: z.string().max(500).optional(),
});

function firstOfMonth(p: string) {
  return `${p}-01`;
}
function lastOfMonth(p: string) {
  const [y, m] = p.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth + role check
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: roleRows } = await admin
    .from("user_roles").select("roles(name)").eq("user_id", userId);
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
  const { period_month, notes } = parsed.data;
  const dateFrom = firstOfMonth(period_month);
  const dateTo = lastOfMonth(period_month);

  try {
    // Load tenants
    const { data: tenants } = await admin
      .from("tenants").select("id,name,currency").eq("is_active", true);
    const tenantById = new Map((tenants ?? []).map((t: any) => [t.id, t]));

    // Load transactions for period
    const { data: txs, error: txErr } = await admin
      .from("finance_transactions")
      .select("id, tenant_id, counterparty_tenant_id, is_intercompany, amount, currency, transaction_type, booking_date")
      .gte("booking_date", dateFrom)
      .lte("booking_date", dateTo)
      .limit(50000);
    if (txErr) throw txErr;

    // Load IC matches whose tx is in this period
    const txIds = (txs ?? []).map((t: any) => t.id);
    let icMatches: any[] = [];
    if (txIds.length) {
      const { data: ms } = await admin
        .from("finance_intercompany_matches")
        .select("source_tx_id, target_tx_id, amount, currency")
        .in("source_tx_id", txIds);
      icMatches = ms ?? [];
    }
    const matchedTxIds = new Set<string>();
    for (const m of icMatches) {
      matchedTxIds.add(m.source_tx_id);
      matchedTxIds.add(m.target_tx_id);
    }

    // Load latest FX rate per currency up to dateTo
    const { data: fxRows } = await admin
      .from("finance_fx_rates")
      .select("currency, rate_date, rate_to_eur")
      .lte("rate_date", dateTo)
      .order("rate_date", { ascending: false });
    const fxMap = new Map<string, number>();
    for (const f of fxRows ?? []) {
      if (!fxMap.has(f.currency)) fxMap.set(f.currency, Number(f.rate_to_eur));
    }
    fxMap.set("EUR", 1);
    const toEur = (amount: number, cur: string) => {
      const r = fxMap.get(cur || "EUR") ?? 1;
      return Number(amount) * r;
    };

    // Aggregate per tenant + transaction_type
    type Key = string;
    const buckets = new Map<Key, {
      tenant_id: string | null;
      transaction_type: string | null;
      gross: number;
      eliminated: number;
    }>();
    const k = (t: string | null, type: string | null) => `${t ?? "_"}|${type ?? "_"}`;

    for (const tx of txs ?? []) {
      const key = k(tx.tenant_id, tx.transaction_type);
      const eur = toEur(Number(tx.amount ?? 0), tx.currency ?? "EUR");
      let b = buckets.get(key);
      if (!b) {
        b = { tenant_id: tx.tenant_id, transaction_type: tx.transaction_type, gross: 0, eliminated: 0 };
        buckets.set(key, b);
      }
      b.gross += eur;
      if (tx.is_intercompany || matchedTxIds.has(tx.id)) {
        b.eliminated += eur;
      }
    }

    // Replace existing run for the same period (idempotent re-run)
    await admin
      .from("finance_consolidation_runs")
      .delete()
      .eq("period_month", dateFrom);

    const totalGross = [...buckets.values()].reduce((s, b) => s + b.gross, 0);
    const totalElim = [...buckets.values()].reduce((s, b) => s + b.eliminated, 0);

    const { data: runRow, error: runErr } = await admin
      .from("finance_consolidation_runs")
      .insert({
        period_month: dateFrom,
        status: "completed",
        prepared_by: userId,
        notes: notes ?? null,
        tenant_count: new Set([...buckets.values()].map((b) => b.tenant_id)).size,
        gross_total: totalGross,
        eliminated_total: totalElim,
        consolidated_total: totalGross - totalElim,
        totals: {
          tenants: Object.fromEntries(
            Array.from(
              [...buckets.values()].reduce((acc, b) => {
                if (!b.tenant_id) return acc;
                const name = tenantById.get(b.tenant_id)?.name ?? b.tenant_id;
                acc.set(name, (acc.get(name) ?? 0) + (b.gross - b.eliminated));
                return acc;
              }, new Map<string, number>())
            )
          ),
        },
      })
      .select("id")
      .single();
    if (runErr) throw runErr;

    const items = [...buckets.values()].map((b) => ({
      run_id: runRow.id,
      tenant_id: b.tenant_id,
      account_label: tenantById.get(b.tenant_id ?? "")?.name ?? null,
      transaction_type: b.transaction_type,
      currency: "EUR",
      gross_amount: b.gross,
      eliminated_amount: b.eliminated,
      consolidated_amount: b.gross - b.eliminated,
    }));
    if (items.length) {
      const { error: itemsErr } = await admin
        .from("finance_consolidation_items").insert(items);
      if (itemsErr) throw itemsErr;
    }

    return new Response(JSON.stringify({
      ok: true,
      run_id: runRow.id,
      tenant_count: new Set(items.map((i) => i.tenant_id)).size,
      gross_total: totalGross,
      eliminated_total: totalElim,
      consolidated_total: totalGross - totalElim,
      items_count: items.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("consolidation error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
