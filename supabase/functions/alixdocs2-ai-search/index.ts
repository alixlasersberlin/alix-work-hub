// ALIXDocs AI 2.0 — Phase 5: AI/RAG-Suche
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovable = Deno.env.get("LOVABLE_API_KEY");
  if (!lovable) return json(500, { error: "LOVABLE_API_KEY missing" });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });
  const uc = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: a } = await uc.rpc("has_role", { check_role: "Admin" });
  const { data: s } = await uc.rpc("has_role", { check_role: "Super Admin" });
  if (!a && !s) return json(403, { error: "forbidden" });

  const body = await req.json().catch(() => ({}));
  const question = String(body?.question ?? "").trim();
  if (!question) return json(400, { error: "question_required" });

  const admin = createClient(url, service);
  const { data: hits } = await admin.rpc("alixdocs2_fts_search", { _query: question, _limit: 12 });
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
  if (!r.ok) return json(r.status, { error: "ai_failed", detail: (await r.text()).slice(0, 300), sources });
  const j = await r.json();
  return json(200, { answer: j?.choices?.[0]?.message?.content ?? "", sources });
});
