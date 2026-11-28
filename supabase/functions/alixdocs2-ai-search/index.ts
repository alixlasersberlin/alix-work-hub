// ALIXDocs AI 2.0 — Phase 5: AI/RAG-Suche
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireCallerAccess } from "../_shared/caller-access.ts";

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const access = await requireCallerAccess(req, corsHeaders, ["Admin", "Super Admin"]);
  if ('response' in access) return access.response;
  const lovable = Deno.env.get("LOVABLE_API_KEY");
  if (!lovable) return json(503, { error: "ai_unavailable" });

  const body = await req.json().catch(() => ({}));
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return json(400, { error: "question_required" });
  if (question.length > 4000) return json(400, { error: "question_too_long" });

  // Never retrieve document context with elevated credentials: both RPC layers
  // use invoker rights so the caller's document and company policies apply.
  const { data: hits, error: searchError } = await access.caller.rpc("alixdocs2_fts_search", { _query: question, _limit: 12 });
  if (searchError) return json(503, { error: "document_search_unavailable" });
  const sources = (hits ?? []).map((d: any, i: number) => ({
    idx: i + 1, id: d.id, title: d.title || d.id, snippet: d.snippet || "",
  }));

  if (sources.length === 0) return json(200, { answer: "Keine relevanten Dokumente gefunden.", sources: [] });

  const context = sources.map((x: any) => `[${x.idx}] ${x.title}\n${x.snippet}`).join("\n\n---\n\n");
  const sys = `Du bist ein interner Dokumenten-Assistent für Alix Lasers (AlixDocs AI 2.0).
Antworte AUSSCHLIESSLICH auf Basis des Kontexts. Zitiere Aussagen mit [1], [2] passend zur Quellenliste.
Fehlt die Info: "In den vorhandenen Dokumenten nicht gefunden." Antworte auf Deutsch, kompakt.`;

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovable}` },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: sys }, { role: "user", content: `Frage: ${question}\n\nKontext:\n${context}` }],
    }),
  });
  if (!r.ok) return json(502, { error: "ai_failed" });
  const j = await r.json();
  return json(200, { answer: j?.choices?.[0]?.message?.content ?? "", sources });
});
