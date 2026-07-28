// ALIXDocs Embeddings — chunkt OCR-Text eines Dokuments und speichert Vektoren.
// POST { document_id }        -> Indiziert Dokument
// POST { query: "..." }       -> Liefert query-embedding + Treffer via RPC
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/embeddings";
const MODEL = "openai/text-embedding-3-small"; // 1536-dim, passt zur Spalte

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const out: string[] = [];
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return out;
  let i = 0;
  while (i < clean.length) {
    out.push(clean.slice(i, i + size));
    if (i + size >= clean.length) break;
    i += size - overlap;
  }
  return out.slice(0, 100); // Safety cap
}

async function embed(texts: string[], key: string): Promise<number[][]> {
  const r = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });
  if (!r.ok) throw new Error(`Embed ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.data.map((d: any) => d.embedding);
}

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

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json(500, { error: "missing LOVABLE_API_KEY" });

    const body = await req.json().catch(() => ({}));

    // Query-Modus
    if (body.query && typeof body.query === "string") {
      const [vec] = await embed([body.query.trim()], key);
      const { data, error } = await supa.rpc("alixdocs2_match_embeddings", {
        query_embedding: vec,
        match_count: Number(body.limit ?? 20),
      });
      if (error) return json(500, { error: error.message });
      return json(200, { hits: data ?? [] });
    }

    // Index-Modus
    const documentId = String(body.document_id ?? "").trim();
    if (!documentId) return json(400, { error: "document_id or query required" });

    const { data: doc } = await supa
      .from("alixdocs2_documents")
      .select("id,ocr_text,title,editor_html")
      .eq("id", documentId)
      .maybeSingle();
    if (!doc) return json(404, { error: "document not found" });

    const raw = [doc.title ?? "", doc.ocr_text ?? "", (doc.editor_html ?? "").replace(/<[^>]+>/g, " ")].join("\n");
    const chunks = chunkText(raw);
    if (chunks.length === 0) return json(200, { indexed: 0, note: "no text" });

    const vectors = await embed(chunks, key);

    // Alte Chunks löschen, neue einfügen
    await supa.from("alixdocs2_embeddings").delete().eq("doc_id", documentId);
    const rows = chunks.map((content, idx) => ({
      doc_id: documentId,
      chunk_index: idx,
      content,
      embedding: vectors[idx] as any,
      model: MODEL,
    }));
    const { error: insErr } = await supa.from("alixdocs2_embeddings").insert(rows);
    if (insErr) return json(500, { error: insErr.message });

    return json(200, { indexed: rows.length });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
