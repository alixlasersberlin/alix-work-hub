// AI Center – generischer Chat/Analyse-Endpunkt für das AI Service Center.
// Nimmt {messages, response_format?, model?} entgegen, ruft Lovable AI Gateway
// und liefert die Antwort als Text/JSON zurück. KEINE Tools, KEINE Auto-Decisions.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages : null;
    if (!messages || messages.length === 0) {
      return json({ error: "messages required" }, 400);
    }
    const model = typeof body?.model === "string" ? body.model : "google/gemini-3-flash-preview";
    const responseFormat = body?.response_format ?? undefined;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY fehlt" }, 500);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "raw-fetch",
      },
      body: JSON.stringify({ model, messages, ...(responseFormat ? { response_format: responseFormat } : {}) }),
    });

    if (aiRes.status === 429) return json({ error: "Rate Limit erreicht. Bitte später erneut versuchen." }, 429);
    if (aiRes.status === 402) return json({ error: "AI-Guthaben aufgebraucht. Bitte Credits aufladen." }, 402);
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return json({ error: `AI-Fehler: ${aiRes.status} ${txt.slice(0, 400)}` }, 502);
    }
    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content ?? "";
    return json({ content, usage: aiJson.usage ?? null, model });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? "Unbekannter Fehler" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
