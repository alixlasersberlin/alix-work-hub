// Phase 10 – KI-Kommentar zu Cockpit/BWA/Soll-Ist/Forecast
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireCallerAccess } from "../_shared/caller-access.ts";
import { FinanceAiInput, selectedTenantIds, allActiveTenantsAssigned } from "../_shared/business-input.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM = `Du bist Finanz-Controller eines deutschen Medizintechnik-Unternehmens.
Analysiere die übergebenen Finanzkennzahlen knapp, präzise, faktenbasiert auf Deutsch.
Format: Markdown mit Abschnitten "Gesamtlage", "Auffälligkeiten", "Empfehlungen".
Maximal 250 Wörter. Keine Spekulation ohne Datenbasis.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const access = await requireCallerAccess(req, corsHeaders, ['Super Admin','Admin','Finance','Geschäftsführung']);
    if ('response' in access) return access.response;
    const supa = access.caller;
    const user = access.user;
    const parsed = FinanceAiInput.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { scope, tenant_id = null, period_start = null, period_end = null, kpis } = parsed.data;
    const tenantIds = selectedTenantIds(access.tenants.map(t => t.id), tenant_id);
    // Unscoped records are permitted only for callers assigned every active company.
    const {data:activeTenants,error:tenantError}=await createClient(SUPABASE_URL,SERVICE_ROLE).from('tenants').select('id').eq('is_active',true);
    const globalAggregate=!tenantError && tenant_id===null && allActiveTenantsAssigned(access.tenants.map(t=>t.id),(activeTenants??[]).map(t=>t.id));
    if (!tenantIds || (tenant_id === null && tenantIds.length !== 1 && !globalAggregate)) return new Response(JSON.stringify({ error: 'Bitte eine zugängliche Firma auswählen' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const insightTenant = globalAggregate ? null : tenant_id ?? tenantIds[0];

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

    const { data: ins, error: insertError } = await supa.from("finance_ai_insights").insert({
      tenant_id: insightTenant, scope, period_start, period_end,
      prompt: userMsg, response, model: MODEL, created_by: user.id,
    }).select().single();
    if (insertError || !ins) return new Response(JSON.stringify({ error: 'Finanzanalyse konnte nicht gespeichert werden' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    return new Response(JSON.stringify({ ok: true, insight: ins, response }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
