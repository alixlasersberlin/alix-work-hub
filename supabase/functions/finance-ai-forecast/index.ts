// Phase 10 – KI-Forecast: schreibt scenario='ai' Werte in finance_forecasts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const tenant_id = body.tenant_id ?? null;
    const category = String(body.category || "Umsatz");
    const months = Math.min(Math.max(Number(body.months || 6), 1), 12);

    // 12 Monate Historie holen
    const since = new Date(); since.setMonth(since.getMonth() - 12); since.setDate(1);
    const { data: tx } = await supa.from("finance_transactions")
      .select("amount, transaction_type, booking_date")
      .gte("booking_date", since.toISOString().slice(0, 10));

    const monthly = new Map<string, number>();
    for (const r of tx ?? []) {
      const t = (r.transaction_type || "").toLowerCase();
      const matches = category === "Umsatz"
        ? ["rechnung", "einnahme", "erlös", "erloes"].some(x => t.includes(x))
        : t.includes(category.toLowerCase());
      if (!matches) continue;
      const key = String(r.booking_date).slice(0, 7);
      monthly.set(key, (monthly.get(key) || 0) + Math.abs(Number(r.amount) || 0));
    }
    const history = [...monthly.entries()].sort().slice(-12);

    // KI fragen
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `Du bist Finanz-Forecaster. Antworte STRENG als JSON-Array mit ${months} Zahlen (EUR, ohne Trennzeichen), basierend auf historischer Saisonalität & Trend. Kein Markdown, kein Text drumherum.` },
          { role: "user", content: `Kategorie: ${category}\nHistorie (Monat → EUR):\n${history.map(([m,v])=>`${m}: ${v.toFixed(0)}`).join("\n")}\n\nProgose für die nächsten ${months} Monate als JSON-Array, z.B. [12345, 13000, ...]` },
        ],
      }),
    });
    if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Credits aufgebraucht" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiRes.ok) return new Response(JSON.stringify({ error: `AI ${aiRes.status}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const j = await aiRes.json();
    const txt = (j.choices?.[0]?.message?.content ?? "").trim().replace(/^```json|```$/g, "").trim();
    let arr: number[] = [];
    try { arr = JSON.parse(txt); } catch { arr = []; }
    if (!Array.isArray(arr) || arr.length === 0) return new Response(JSON.stringify({ error: "AI returned no usable array", raw: txt }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const start = new Date(); start.setMonth(start.getMonth() + 1); start.setDate(1);
    const rows = arr.slice(0, months).map((v, i) => {
      const d = new Date(start); d.setMonth(d.getMonth() + i);
      return {
        tenant_id, scenario: "ai", category,
        period_date: d.toISOString().slice(0, 10),
        forecast_amount: Number(v) || 0,
      };
    });

    const { error } = await supa.from("finance_forecasts").upsert(rows, { onConflict: "tenant_id,period_date,category,scenario" });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ ok: true, written: rows.length, rows }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
