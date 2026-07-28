// ALIXDocs Copilot — Chat mit einem Dokument (nutzt ocr_text + ai_entities als Kontext)
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MODEL = "openai/gpt-5.6-sol";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json(401, { error: "unauthorized" });
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: userRes } = await supa.auth.getUser();
    if (!userRes.user) return json(401, { error: "unauthorized" });

    const body = await req.json().catch(() => ({}));
    const documentId = String(body.document_id ?? "").trim();
    const action = String(body.action ?? "chat");
    const question = String(body.question ?? "").trim();
    if (!documentId) return json(400, { error: "document_id required" });

    const { data: doc, error } = await supa
      .from("alixdocs2_documents")
      .select("id,title,doc_type,ai_tags,ai_entities,ocr_text")
      .eq("id", documentId)
      .maybeSingle();
    if (error || !doc) return json(404, { error: "document not found" });

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json(500, { error: "missing LOVABLE_API_KEY" });

    const context = (doc.ocr_text ?? "").slice(0, 12000);
    const meta = `Titel: ${doc.title}\nTyp: ${doc.doc_type ?? "-"}\nTags: ${(doc.ai_tags ?? []).join(", ") || "-"}\nEntitäten: ${JSON.stringify(doc.ai_entities ?? {})}`;

    let userPrompt = "";
    if (action === "summary") {
      userPrompt = "Fasse dieses Dokument in 5-8 Bulletpoints auf Deutsch zusammen. Nenne die wichtigsten Fakten, Daten und beteiligten Parteien.";
    } else if (action === "risks") {
      userPrompt = "Analysiere Risiken, Fristen und Verpflichtungen in diesem Dokument. Antwort auf Deutsch, klar gegliedert.";
    } else if (action === "classify") {
      userPrompt = "Klassifiziere dieses Dokument (Doku-Typ, Kategorie, mögliche Tags) und begründe kurz. Antwort auf Deutsch.";
    } else if (question) {
      userPrompt = question;
    } else {
      return json(400, { error: "question or valid action required" });
    }

    const messages = [
      {
        role: "system",
        content:
          "Du bist der ALIXDocs Copilot. Antworte prägnant, faktenbasiert und ausschließlich auf Grundlage des bereitgestellten Dokuments. Wenn Informationen fehlen, sage das ehrlich.",
      },
      { role: "user", content: `METADATEN:\n${meta}\n\nDOKUMENT-TEXT:\n${context}\n\nFRAGE/AUFGABE:\n${userPrompt}` },
    ];

    const r = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, messages, reasoning_effort: "none" }),
    });
    if (r.status === 429) return json(429, { error: "AI rate limit — bitte kurz warten." });
    if (r.status === 402) return json(402, { error: "AI-Credits aufgebraucht." });
    if (!r.ok) return json(r.status, { error: `AI Gateway ${r.status}: ${await r.text()}` });
    const data = await r.json();
    const answer = data.choices?.[0]?.message?.content ?? "";

    return json(200, { answer, action });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
