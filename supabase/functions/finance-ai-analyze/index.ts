// Phase 10 – KI-Kommentar zu Cockpit/BWA/Soll-Ist/Forecast
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "google/gemini-2.5-flash";

const SYSTEM = `Du bist Finanz-Controller eines deutschen Medizintechnik-Unternehmens.
Analysiere die übergebenen Finanzkennzahlen knapp, präzise, faktenbasiert auf Deutsch.
Format: Markdown mit Abschnitten "Gesamtlage", "Auffälligkeiten", "Empfehlungen".
Maximal 250 Wörter. Keine Spekulation ohne Datenbasis.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const scope = String(body.scope || "cockpit");
    const tenant_id = body.tenant_id ?? null;
    const period_start = body.period_start ?? null;
    const period_end = body.period_end ?? null;
    const kpis = body.kpis ?? {};

    const userMsg = `Bereich: ${scope}\nZeitraum: ${period_start ?? "?"} – ${period_end ?? "?"}\nKennzahlen (JSON):\n${JSON.stringify(kpis, null, 2)}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit erreicht, bitte später erneut versuchen." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: "KI-Guthaben aufgebraucht. Bitte Workspace-Credits aufladen." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiRes.ok) return new Response(JSON.stringify({ error: `AI error ${aiRes.status}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const j = await aiRes.json();
    const response = j.choices?.[0]?.message?.content ?? "";

    const { data: ins } = await supa.from("finance_ai_insights").insert({
      tenant_id, scope, period_start, period_end,
      prompt: userMsg, response, model: MODEL, created_by: user.id,
    }).select().single();

    return new Response(JSON.stringify({ ok: true, insight: ins, response }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
