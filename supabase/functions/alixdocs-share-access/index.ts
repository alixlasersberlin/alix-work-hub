// AlixDocs — Public access to a share link
// GET  ?token=...              -> metadata (docs listing) — password required check
// POST { token, password? }    -> list + signed URLs (single-use per download increment)
// GET  ?token=...&download=zip -> ZIP stream (after password unlock via POST returning session_key not implemented; keep simple: password param supported)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import JSZip from 'https://esm.sh/jszip@3.10.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const BUCKET = 'alixdocs-private';
function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const h = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, service);

  let token = ''; let password: string | null = null; let mode = 'meta';
  if (req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    token = String(b.token || '').trim(); password = b.password ? String(b.password) : null;
    mode = String(b.mode || 'list');
  } else {
    const u = new URL(req.url); token = u.searchParams.get('token') || '';
    password = u.searchParams.get('password'); mode = u.searchParams.get('mode') || 'meta';
  }
  if (!token) return json(400, { error: 'missing_token' });

  const { data: link, error } = await admin.from('alixdocs_share_links').select('*').eq('token', token).maybeSingle();
  if (error) return json(500, { error: error.message });
  if (!link) return json(404, { error: 'not_found' });
  if (link.revoked_at) return json(410, { error: 'revoked' });
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return json(410, { error: 'expired' });
  if (link.max_downloads && link.download_count >= link.max_downloads) return json(410, { error: 'download_limit_reached' });

  const needsPw = !!link.password_hash;
  if (mode === 'meta') {
    return json(200, {
      requires_password: needsPw,
      expires_at: link.expires_at, note: link.note,
      max_downloads: link.max_downloads, download_count: link.download_count,
      document_count: (link.document_ids as string[]).length,
    });
  }

  if (needsPw) {
    if (!password) return json(401, { error: 'password_required' });
    const h = await sha256Hex(password);
    if (h !== link.password_hash) return json(401, { error: 'invalid_password' });
  }

  const { data: docs } = await admin.from('alixdocs_documents')
    .select('id, title, original_filename, current_version, mime_type, file_size')
    .in('id', link.document_ids as string[])
    .is('deleted_at', null);

  if (mode === 'list') {
    return json(200, {
      documents: (docs || []).map(d => ({
        id: d.id, title: d.title, filename: d.original_filename,
        mime_type: d.mime_type, size: d.file_size, version: d.current_version,
      })),
      expires_at: link.expires_at, remaining_downloads: link.max_downloads ? link.max_downloads - link.download_count : null,
    });
  }

  if (mode === 'zip') {
    const zip = new JSZip(); const used = new Set<string>();
    for (const d of docs || []) {
      const { data: v } = await admin.from('alixdocs_versions').select('storage_path')
        .eq('document_id', d.id).eq('version_number', d.current_version).maybeSingle();
      if (!v?.storage_path) continue;
      const { data: blob } = await admin.storage.from(BUCKET).download(v.storage_path);
      if (!blob) continue;
      let name = (d.original_filename || `${d.title}.pdf`).replace(/[\\/:*?"<>|]/g, '_');
      let unique = name, n = 1;
      while (used.has(unique)) { const dot = name.lastIndexOf('.'); unique = dot > 0 ? `${name.slice(0, dot)}_${n}${name.slice(dot)}` : `${name}_${n}`; n++; }
      used.add(unique);
      zip.file(unique, new Uint8Array(await blob.arrayBuffer()));
    }
    await admin.from('alixdocs_share_links').update({
      download_count: link.download_count + 1, last_accessed_at: new Date().toISOString(),
    }).eq('id', link.id);
    const out = await zip.generateAsync({ type: 'uint8array' });
    return new Response(out, { headers: { ...corsHeaders, 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="alixdocs_share_${token.slice(0,8)}.zip"` } });
  }

  if (mode === 'signed_url') {
    const docId = req.method === 'POST' ? (await req.json().catch(() => ({}))).document_id : new URL(req.url).searchParams.get('document_id');
    if (!docId || !(link.document_ids as string[]).includes(String(docId))) return json(403, { error: 'not_in_share' });
    const doc = (docs || []).find(x => x.id === docId);
    if (!doc) return json(404, { error: 'doc_missing' });
    const { data: v } = await admin.from('alixdocs_versions').select('storage_path')
      .eq('document_id', doc.id).eq('version_number', doc.current_version).maybeSingle();
    if (!v?.storage_path) return json(404, { error: 'no_file' });
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(v.storage_path, 300);
    await admin.from('alixdocs_share_links').update({
      download_count: link.download_count + 1, last_accessed_at: new Date().toISOString(),
    }).eq('id', link.id);
    return json(200, { url: signed?.signedUrl, mime_type: doc.mime_type });
  }

  return json(400, { error: 'invalid_mode' });
});
