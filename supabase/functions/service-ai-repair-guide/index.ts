// AI Service Assistent - Reparaturanleitung
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Du bist ein erfahrener Servicetechniker. Erzeuge eine vollständige Reparaturanleitung als STRIKT valides JSON ohne Markdown:
{
  "titel": string,
  "pruefschritte": string[],
  "reparaturschritte": string[],
  "sicherheit": string[],
  "abschlusspruefung": string[]
}
Antworte auf Deutsch. Jede Liste enthält klare, nummerierbare Anweisungen.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { analysis_id } = await req.json();
    if (!analysis_id) return json({ error: "analysis_id erforderlich" }, 400);

    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "Nicht authentifiziert" }, 401);

    const { data: analysis, error } = await supabase
      .from("service_ai_analyses")
      .select("*")
      .eq("id", analysis_id)
      .maybeSingle();
    if (error || !analysis) return json({ error: "Analyse nicht gefunden" }, 404);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY fehlt" }, 500);

    const userPrompt = `### Geräteinformation
Typ: ${analysis.device_type ?? "unbekannt"}
Modell: ${analysis.device_model ?? "unbekannt"}
Seriennummer: ${analysis.serial_number ?? "unbekannt"}

### Diagnose der AI
Ursache: ${analysis.ursache ?? "-"}
Empfohlene Reparatur: ${analysis.reparatur_empfehlung ?? "-"}
Prüfschritte (bisher): ${JSON.stringify(analysis.pruefschritte ?? [])}
Ersatzteile: ${JSON.stringify(analysis.ersatzteile ?? [])}

Erzeuge jetzt die vollständige Anleitung als JSON.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) return json({ error: "Rate Limit erreicht." }, 429);
    if (aiRes.status === 402) return json({ error: "AI-Guthaben aufgebraucht." }, 402);
    if (!aiRes.ok) return json({ error: `AI-Fehler ${aiRes.status}` }, 502);

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const { data: inserted, error: insErr } = await supabase
      .from("service_ai_repair_guides")
      .insert({
        analysis_id,
        ticket_id: analysis.ticket_id,
        repair_order_id: analysis.repair_order_id,
        titel: parsed.titel ?? `Reparaturanleitung ${analysis.device_model ?? ""}`.trim(),
        pruefschritte: parsed.pruefschritte ?? [],
        reparaturschritte: parsed.reparaturschritte ?? [],
        sicherheit: parsed.sicherheit ?? [],
        abschlusspruefung: parsed.abschlusspruefung ?? [],
        model: "google/gemini-2.5-flash",
        created_by: userId,
      })
      .select()
      .single();

    if (insErr) return json({ error: `DB-Fehler: ${insErr.message}` }, 500);
    return json({ guide: inserted });
  } catch (e: any) {
    return json({ error: e?.message ?? "Unbekannter Fehler" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
