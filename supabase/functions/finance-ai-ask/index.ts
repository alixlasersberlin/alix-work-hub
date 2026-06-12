// Phase 10 – Natürlichsprachliche Finanz-Abfrage via Function-Calling (sichere Read-Queries).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "google/gemini-2.5-flash";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "sum_revenue",
      description: "Summiert Umsatz (Rechnungen/Einnahmen) aus finance_transactions in einem Zeitraum.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "YYYY-MM-DD" },
          end_date: { type: "string", description: "YYYY-MM-DD" },
          customer_id: { type: "string", description: "UUID, optional" },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_overdue_invoices",
      description: "Listet überfällige offene Eingangs-/Ausgangsrechnungen über einer Mindestanzahl Tage.",
      parameters: {
        type: "object",
        properties: { min_days_overdue: { type: "number" } },
        required: ["min_days_overdue"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "customer_balance",
      description: "Aktueller Saldo & Overdue eines Kunden aus finance_accounts.",
      parameters: {
        type: "object",
        properties: { customer_id: { type: "string", description: "UUID" } },
        required: ["customer_id"],
      },
    },
  },
];

async function execTool(supa: any, name: string, args: any) {
  if (name === "sum_revenue") {
    let q = supa.from("finance_transactions").select("amount, transaction_type, customer_id, booking_date")
      .gte("booking_date", args.start_date).lte("booking_date", args.end_date).limit(5000);
    if (args.customer_id) q = q.eq("customer_id", args.customer_id);
    const { data } = await q;
    const sum = (data ?? [])
      .filter((r: any) => ["rechnung","einnahme","erlös","erloes"].some(x => (r.transaction_type||"").toLowerCase().includes(x)))
      .reduce((s: number, r: any) => s + Math.abs(Number(r.amount) || 0), 0);
    return { sum_eur: sum, count: data?.length ?? 0 };
  }
  if (name === "list_overdue_invoices") {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - Number(args.min_days_overdue || 30));
    const { data } = await supa.from("finance_incoming_invoices")
      .select("id, supplier_id, invoice_number, amount_gross, due_date, paid_at, description")
      .is("paid_at", null).lte("due_date", cutoff.toISOString().slice(0,10)).limit(50);
    return { count: data?.length ?? 0, items: data ?? [] };
  }
  if (name === "customer_balance") {
    const { data } = await supa.from("finance_accounts").select("*").eq("customer_id", args.customer_id).maybeSingle();
    return data ?? { found: false };
  }
  return { error: "unknown_tool" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Restrict to users with finance access (Super Admin/Admin/Finance).
    const { data: canFinance } = await userClient.rpc('can_access_finance');
    if (!canFinance) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { question } = await req.json();
    if (!question) return new Response(JSON.stringify({ error: "question required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const messages: any[] = [
      { role: "system", content: "Du bist Finanz-Assistent. Beantworte deutsche Fragen mithilfe der Tools. Antworte präzise auf Deutsch mit konkreten Zahlen. Heute ist " + new Date().toISOString().slice(0,10) + "." },
      { role: "user", content: String(question) },
    ];

    for (let i = 0; i < 5; i++) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: "auto" }),
      });
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Credits aufgebraucht" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!aiRes.ok) return new Response(JSON.stringify({ error: `AI ${aiRes.status}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const j = await aiRes.json();
      const msg = j.choices?.[0]?.message;
      if (!msg) break;
      messages.push(msg);
      const calls = msg.tool_calls ?? [];
      if (calls.length === 0) {
        return new Response(JSON.stringify({ answer: msg.content ?? "" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      for (const c of calls) {
        let args: any = {};
        try { args = JSON.parse(c.function.arguments || "{}"); } catch { /* */ }
        const result = await execTool(supa, c.function.name, args);
        messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result) });
      }
    }
    return new Response(JSON.stringify({ answer: "Konnte keine Antwort generieren." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
