// AlixDocs Hash-Backfill (Etappe 6)
// - Iteriert alixdocs_documents ohne content_hash
// - Lädt Datei aus Storage-Bucket 'alixdocs' (Pfad = versionierter Storage-Key aus alixdocs_versions.storage_path oder documents.original_filename-Konvention)
// - Berechnet SHA-256 und schreibt content_hash
// - Batch-Grösse: 25 pro Aufruf, damit die Function unter dem 60s-Timeout bleibt
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireProcessAccess } from '../_shared/process-access.ts';
import { z } from 'npm:zod@3.25.76';

const BodySchema = z.object({ batch: z.number().int().min(1).max(100).default(25) }).strict();

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const access = await requireProcessAccess(req, corsHeaders, ['Super Admin', 'Admin']);
  if ('response' in access) return access.response;
  const supa = access.client;
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json(400, { error: 'batch must be an integer from 1 to 100' });
  const { batch } = parsed.data;

  // Dokumente ohne Hash finden
  const { data: docs, error } = await supa
    .from("alixdocs_documents")
    .select("id, current_version")
    .is("content_hash", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(batch);
  if (error) return json(500, { error: error.message });
  if (!docs || docs.length === 0) return json(200, { ok: true, processed: 0, remaining: 0 });

  let ok = 0, failed = 0;
  for (const d of docs) {
    try {
      const { data: ver } = await supa
        .from("alixdocs_versions")
        .select("storage_path")
        .eq("document_id", d.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const path = (ver as any)?.storage_path;
      if (!path) { failed++; continue; }

      const { data: file, error: dlErr } = await supa.storage.from("alixdocs").download(path);
      if (dlErr || !file) { failed++; continue; }

      const buf = await file.arrayBuffer();
      const hash = await sha256Hex(buf);

      await supa.from("alixdocs_documents").update({ content_hash: hash }).eq("id", d.id);
      ok++;
    } catch (_e) {
      failed++;
    }
  }

  const { count: remaining } = await supa
    .from("alixdocs_documents")
    .select("id", { count: "exact", head: true })
    .is("content_hash", null)
    .is("deleted_at", null);

  return json(200, { ok: true, processed: ok, failed, remaining: remaining ?? 0 });
});
