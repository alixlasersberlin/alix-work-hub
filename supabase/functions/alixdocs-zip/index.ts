// AlixDocs — Bulk ZIP Download
// Input: { document_ids: string[], version?: 'current' }
// Auth: JWT required. Uses RLS via userClient to check reads, then service role to fetch files.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import JSZip from 'https://esm.sh/jszip@3.10.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const BUCKET = 'alixdocs-private';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json(401, { error: 'missing_auth' });
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json(401, { error: 'unauthorized' });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  const ids: string[] = Array.isArray(body?.document_ids) ? body.document_ids.filter(Boolean) : [];
  if (ids.length === 0 || ids.length > 200) return json(400, { error: 'invalid_document_ids' });

  // RLS-scoped read
  const { data: docs, error } = await userClient
    .from('alixdocs_documents')
    .select('id, title, original_filename, current_version, mime_type')
    .in('id', ids)
    .is('deleted_at', null);
  if (error) return json(500, { error: error.message });
  if (!docs || docs.length === 0) return json(404, { error: 'no_docs_accessible' });

  const admin = createClient(url, service);
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const d of docs) {
    const { data: v } = await admin
      .from('alixdocs_versions')
      .select('storage_path')
      .eq('document_id', d.id)
      .eq('version_number', d.current_version)
      .maybeSingle();
    if (!v?.storage_path) continue;
    const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(v.storage_path);
    if (dlErr || !blob) continue;
    let name = d.original_filename || `${d.title}.pdf`;
    name = name.replace(/[\\/:*?"<>|]/g, '_');
    let unique = name; let n = 1;
    while (usedNames.has(unique)) { const dot = name.lastIndexOf('.'); unique = dot > 0 ? `${name.slice(0, dot)}_${n}${name.slice(dot)}` : `${name}_${n}`; n++; }
    usedNames.add(unique);
    zip.file(unique, new Uint8Array(await blob.arrayBuffer()));
  }

  const out = await zip.generateAsync({ type: 'uint8array' });
  return new Response(out, {
    headers: { ...corsHeaders, 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="alixdocs_${new Date().toISOString().slice(0,10)}.zip"` },
  });
});
