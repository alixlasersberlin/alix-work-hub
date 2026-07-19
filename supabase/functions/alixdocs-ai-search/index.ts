// AlixDocs AI-Volltextsuche (Etappe 6, RAG)
// - Nimmt Frage
// - Holt Top-Snippets via Postgres FTS auf alixdocs_documents.search_tsv + ts_headline
// - Sendet Kontext an Lovable AI Gateway (Gemini) mit Zitier-Instruktion
// - Antwortet mit { answer, sources: [{id, title, snippet}] }
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return json(500, { error: "LOVABLE_API_KEY missing" });

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isAdmin } = await userClient.rpc("has_role", { check_role: "Admin" });
  const { data: isSuper } = await userClient.rpc("has_role", { check_role: "Super Admin" });
  if (!isAdmin && !isSuper) return json(403, { error: "forbidden" });

  const body = await req.json().catch(() => ({}));
  const question = String(body?.question ?? "").trim();
  if (!question) return json(400, { error: "question_required" });

  const supa = createClient(url, service);

  // Postgres FTS: plainto_tsquery('german', ...)
  const { data: hits, error } = await supa.rpc("alixdocs_fts_search", {
    _query: question,
    _limit: 15,
  });

  if (error) {
    // Fallback: einfacher ILIKE, falls RPC noch nicht deployed
    const like = `%${question.split(/\s+/).slice(0, 3).join("%")}%`;
    const { data: fallback } = await supa
      .from("alixdocs_documents")
      .select("id, title, original_filename, ocr_text")
      .is("deleted_at", null)
      .not("ocr_text", "is", null)
      .ilike("ocr_text", like)
      .limit(15);
    if (!fallback || fallback.length === 0) {
      return json(200, { answer: "Keine relevanten Dokumente gefunden.", sources: [] });
    }
    const sources = fallback.map((d, i) => ({
      idx: i + 1,
      id: d.id,
      title: d.title || d.original_filename || d.id,
      snippet: (d.ocr_text || "").slice(0, 400),
    }));
    return await synthesize(question, sources, lovableKey);
  }

  const sources = (hits ?? []).map((d: any, i: number) => ({
    idx: i + 1,
    id: d.id,
    title: d.title || d.original_filename || d.id,
    snippet: d.snippet || "",
  }));

  if (sources.length === 0) {
    return json(200, { answer: "Keine relevanten Dokumente gefunden.", sources: [] });
  }

  return await synthesize(question, sources, lovableKey);
});

async function synthesize(question: string, sources: any[], lovableKey: string) {
  const context = sources
    .map((s) => `[${s.idx}] ${s.title}\n${s.snippet}`)
    .join("\n\n---\n\n");

  const system = `Du bist ein interner Wissens-Assistent für AlixWork-Dokumente.
Beantworte die Frage AUSSCHLIESSLICH auf Basis des bereitgestellten Kontexts.
Zitiere jede Aussage mit Fußnoten wie [1], [2] passend zur nummerierten Quellenliste.
Falls die Antwort nicht im Kontext steht, sage klar: "In den vorhandenen Dokumenten nicht gefunden."
Antworte auf Deutsch, kompakt und in Absätzen.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Frage: ${question}\n\nKontext:\n${context}` },
      ],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    return json(resp.status, { error: "ai_failed", detail: t.slice(0, 500), sources });
  }
  const j = await resp.json();
  const answer = j?.choices?.[0]?.message?.content ?? "";
  return json(200, { answer, sources });
}
