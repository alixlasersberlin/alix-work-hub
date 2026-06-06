// AI Service Assistent - Fehleranalyse
// Liest Ticket oder Repair-Order + Historie + KB-Treffer, ruft Lovable AI Gateway
// und speichert strukturierte Analyse in service_ai_analyses.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Du bist ein erfahrener Servicetechniker für Medizin-/Wellnessgeräte (insb. Kühlsysteme, Displays, Netzteile).
Analysiere den vorliegenden Fall und liefere STRIKT valides JSON ohne Markdown nach folgendem Schema:
{
  "ursache": string,
  "confidence": number (0-100, Vertrauenswert in %),
  "pruefschritte": string[] (geordnete Prüfschritte),
  "reparatur_empfehlung": string,
  "ersatzteile": [{"name": string, "wahrscheinlichkeit": number (0-100), "begruendung": string}],
  "arbeitszeit": {"min_minuten": number, "erwartet_minuten": number, "max_minuten": number},
  "technikerempfehlung": {"rolle": string, "begruendung": string}
}
Antworte ausschließlich in deutscher Sprache. Wenn Daten fehlen, gib trotzdem die wahrscheinlichste Hypothese und kennzeichne dies in der Begründung.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { source_kind, id } = await req.json();
    if (!source_kind || !id || !["ticket", "repair"].includes(source_kind)) {
      return json({ error: "source_kind ('ticket'|'repair') und id sind erforderlich" }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;
    if (!userId) return json({ error: "Nicht authentifiziert" }, 401);

    // Kontext laden
    let context: any = {};
    let device_type: string | null = null;
    let device_model: string | null = null;
    let serial_number: string | null = null;
    let fehlercode: string | null = null;
    let history: any[] = [];

    if (source_kind === "ticket") {
      const { data: ticket, error } = await supabase
        .from("tickets")
        .select("id, title, description, device_name, serial_number, status, priority, auto_category, customer_name")
        .eq("id", id)
        .maybeSingle();
      if (error || !ticket) return json({ error: "Ticket nicht gefunden" }, 404);
      context = ticket;
      device_type = (ticket as any).auto_category ?? null;
      device_model = (ticket as any).device_name ?? null;
      serial_number = (ticket as any).serial_number ?? null;
      if (serial_number) {
        const { data: pastT } = await supabase
          .from("tickets")
          .select("id, title, description, status, created_at")
          .eq("serial_number", serial_number)
          .neq("id", id)
          .order("created_at", { ascending: false })
          .limit(10);
        const { data: pastR } = await supabase
          .from("repair_orders")
          .select("id, repair_number, diagnosis, issue_description, repair_status, created_at")
          .eq("device_serial_number", serial_number)
          .order("created_at", { ascending: false })
          .limit(10);
        history = [...(pastT ?? []).map((t) => ({ kind: "ticket", ...t })), ...(pastR ?? []).map((r) => ({ kind: "repair", ...r }))];
      }
    } else {
      const { data: repair, error } = await supabase
        .from("repair_orders")
        .select("id, repair_number, device_type, device_brand, device_model, device_serial_number, issue_description, customer_error_description, visible_damages, diagnosis, repair_status, priority, customer_name")
        .eq("id", id)
        .maybeSingle();
      if (error || !repair) return json({ error: "Reparaturauftrag nicht gefunden" }, 404);
      context = repair;
      device_type = (repair as any).device_type ?? null;
      device_model = (repair as any).device_model ?? null;
      serial_number = (repair as any).device_serial_number ?? null;
      if (serial_number) {
        const { data: pastR } = await supabase
          .from("repair_orders")
          .select("id, repair_number, diagnosis, issue_description, repair_status, created_at")
          .eq("device_serial_number", serial_number)
          .neq("id", id)
          .order("created_at", { ascending: false })
          .limit(10);
        history = (pastR ?? []).map((r) => ({ kind: "repair", ...r }));
      }
    }

    // KB-Treffer
    let kbHits: any[] = [];
    if (device_type) {
      const { data: kb } = await supabase
        .from("service_knowledge_base")
        .select("geraetetyp, fehlercode, symptom, ursache, loesung, ersatzteile, arbeitszeit_min, arbeitszeit_erwartet, arbeitszeit_max")
        .ilike("geraetetyp", `%${device_type}%`)
        .limit(8);
      kbHits = kb ?? [];
    }

    const userPrompt = `### Fall (${source_kind})\n${JSON.stringify(context, null, 2)}\n\n### Historie desselben Geräts (${history.length} Einträge)\n${JSON.stringify(history.slice(0, 10), null, 2)}\n\n### Treffer aus Wissensdatenbank\n${JSON.stringify(kbHits, null, 2)}\n\nLiefere jetzt die strukturierte JSON-Analyse.`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY fehlt" }, 500);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "raw-fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) return json({ error: "Rate Limit erreicht. Bitte später erneut versuchen." }, 429);
    if (aiRes.status === 402) return json({ error: "AI-Guthaben aufgebraucht. Bitte Credits aufladen." }, 402);
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return json({ error: `AI-Fehler: ${aiRes.status} ${txt.slice(0, 300)}` }, 502);
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { ursache: content, confidence: 0 }; }

    // Speichern (Service-Role-Insert für Konsistenz, falls RLS-Rolle nicht passt; hier benutzen wir authentifizierten Client)
    const { data: inserted, error: insErr } = await supabase
      .from("service_ai_analyses")
      .insert({
        ticket_id: source_kind === "ticket" ? id : null,
        repair_order_id: source_kind === "repair" ? id : null,
        source_kind,
        device_type,
        device_model,
        serial_number,
        fehlercode,
        prompt_summary: userPrompt.slice(0, 2000),
        ursache: parsed.ursache ?? null,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
        pruefschritte: parsed.pruefschritte ?? [],
        reparatur_empfehlung: parsed.reparatur_empfehlung ?? null,
        ersatzteile: parsed.ersatzteile ?? [],
        arbeitszeit: parsed.arbeitszeit ?? null,
        technikerempfehlung: parsed.technikerempfehlung ?? null,
        raw_response: aiJson,
        model: "google/gemini-2.5-flash",
        tokens_input: aiJson.usage?.prompt_tokens ?? null,
        tokens_output: aiJson.usage?.completion_tokens ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (insErr) return json({ error: `DB-Fehler: ${insErr.message}` }, 500);
    return json({ analysis: inserted });
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
