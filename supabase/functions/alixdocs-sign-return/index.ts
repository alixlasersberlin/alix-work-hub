// alixdocs-sign-return: kopiert das final signierte PDF aus ALIX SIGN PRO als neue Version zurück in AlixDocs.
// Body: { sig_request_id }
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-alix-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function sha256(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
const sanitize = (n: string) => (n || 'signiert.pdf').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!;
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, svc);

  try {
    const { sig_request_id } = await req.json();
    if (!sig_request_id) return json(400, { error: 'sig_request_id required' });

    const { data: req0 } = await admin.from('sig_requests')
      .select('id, status, document_id, alixdocs_document_id, sig_documents(storage_path, title)')
      .eq('id', sig_request_id).single();
    if (!req0 || !req0.alixdocs_document_id) return json(200, { ok: true, skipped: 'no_alixdocs_link' });

    const path = (req0 as any).sig_documents?.storage_path;
    if (!path) return json(400, { error: 'no signed pdf path' });

    const { data: blob, error: dlErr } = await admin.storage.from('sig-documents').download(path);
    if (dlErr || !blob) return json(500, { error: `download failed: ${dlErr?.message}` });

    const buf = await blob.arrayBuffer();
    const bin = new Uint8Array(buf);
    const hash = await sha256(buf);

    const { data: doc } = await admin.from('alixdocs_documents').select('current_version, title, order_id').eq('id', req0.alixdocs_document_id).single();
    const nextVer = (doc?.current_version ?? 1) + 1;
    const filename = sanitize(`${doc?.title ?? 'signiert'}_v${nextVer}_signed.pdf`);
    const newPath = `docs/${req0.alixdocs_document_id}/v${nextVer}/${filename}`;

    const { error: upErr } = await admin.storage.from('alixdocs-private').upload(newPath, bin, { contentType: 'application/pdf', upsert: false });
    if (upErr) return json(500, { error: `upload failed: ${upErr.message}` });

    await admin.from('alixdocs_versions').insert({
      document_id: req0.alixdocs_document_id, version_number: nextVer,
      storage_bucket: 'alixdocs-private', storage_path: newPath,
      file_hash: hash, file_size: bin.byteLength, mime_type: 'application/pdf',
      original_filename: filename, change_note: `Signiert via ALIX SIGN PRO (Request ${sig_request_id.slice(0, 8)})`,
    });
    await admin.from('alixdocs_documents').update({ current_version: nextVer, status: 'freigegeben' }).eq('id', req0.alixdocs_document_id);
    await admin.from('alixdocs_audit_log').insert({
      document_id: req0.alixdocs_document_id, action: 'signed_returned',
      metadata: { sig_request_id, new_version: nextVer, hash },
    });

    return json(200, { ok: true, document_id: req0.alixdocs_document_id, new_version: nextVer });
  } catch (e: any) {
    return json(500, { error: e?.message ?? String(e) });
  }
});
