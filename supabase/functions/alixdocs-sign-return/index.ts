// alixdocs-sign-return: kopiert das final signierte PDF aus ALIX SIGN PRO als neue Version zurück in AlixDocs.
// Body: { sig_request_id }
import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireProcessAccess } from '../_shared/process-access.ts';
import { z } from 'npm:zod@3';

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

  const access = await requireProcessAccess(req, corsHeaders, ['Super Admin', 'Admin', 'Order', 'SACHBEARBEITUNG', 'Vertrieb', 'Service']);
  if ('response' in access) return access.response;
  const admin = access.client;
  const storage = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

  try {
    const parsed = z.object({ sig_request_id: z.string().uuid() }).strict().safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json(400, { error: 'invalid_sig_request_id' });
    const { sig_request_id } = parsed.data;

    const { data: req0 } = await admin.from('sig_requests')
      .select('id, status, document_id, alixdocs_document_id, sig_documents(storage_path, title)')
      .eq('id', sig_request_id).single();
    if (!req0) return json(404, { error: 'signature_request_not_found' });
    if (!req0.alixdocs_document_id) return json(200, { ok: true, skipped: 'no_alixdocs_link' });

    if (req0.status !== 'signiert') return json(409, { error: 'signature_not_complete' });
    const { data: doc, error: docError } = await admin.from('alixdocs_documents').select('id,current_version,title,order_id,customer_id,tenant_id,uploaded_by').eq('id', req0.alixdocs_document_id).single();
    if (docError || !doc) return json(404, { error: 'document_not_found' });
    if (!access.machine) {
      if (doc.tenant_id && !access.tenantIds.includes(doc.tenant_id)) return json(403, { error: 'document_company_denied' });
      let confirmed = !!doc.tenant_id;
      for (const [table, id] of [['orders', doc.order_id], ['customers', doc.customer_id]] as const) {
        if (!id) continue;
        const { data: parent, error } = await admin.from(table).select('id,source_system').eq('id', id).maybeSingle();
        if (error || !parent) return json(403, { error: 'document_parent_denied' });
        const { data: tenant } = await admin.from('tenants').select('id').in('id', access.tenantIds).eq('zoho_source_system', parent.source_system).maybeSingle();
        if (!tenant) return json(403, { error: 'document_parent_company_denied' });
        confirmed = true;
      }
      if (!confirmed && doc.uploaded_by !== access.userId) return json(403, { error: 'document_scope_unconfirmed' });
    }
    const path = (req0 as any).sig_documents?.storage_path;
    if (!path) return json(400, { error: 'no signed pdf path' });

    const { data: blob, error: dlErr } = await storage.storage.from('sig-documents').download(path);
    if (dlErr || !blob) return json(500, { error: `download failed: ${dlErr?.message}` });

    const buf = await blob.arrayBuffer();
    const bin = new Uint8Array(buf);
    const hash = await sha256(buf);

    const nextVer = (doc?.current_version ?? 1) + 1;
    const filename = sanitize(`${doc?.title ?? 'signiert'}_v${nextVer}_signed.pdf`);
    const newPath = `docs/${req0.alixdocs_document_id}/v${nextVer}/${filename}`;

    const { error: upErr } = await storage.storage.from('alixdocs-private').upload(newPath, bin, { contentType: 'application/pdf', upsert: false });
    if (upErr) return json(500, { error: `upload failed: ${upErr.message}` });

    const { error: versionError } = await admin.from('alixdocs_versions').insert({
      document_id: req0.alixdocs_document_id, version_number: nextVer, uploaded_by: access.userId,
      storage_bucket: 'alixdocs-private', storage_path: newPath,
      file_hash: hash, file_size: bin.byteLength, mime_type: 'application/pdf',
      original_filename: filename, change_note: `Signiert via ALIX SIGN PRO (Request ${sig_request_id.slice(0, 8)})`,
    });
    if (versionError) return json(409, { error: 'signature_version_not_saved' });
    const { data: updated, error: updateError } = await admin.from('alixdocs_documents').update({ current_version: nextVer, status: 'freigegeben' }).eq('id', req0.alixdocs_document_id).eq('current_version', doc.current_version).select('id');
    if (updateError || !updated?.length) return json(409, { error: 'signature_document_version_conflict' });
    await admin.from('alixdocs_audit_log').insert({
      document_id: req0.alixdocs_document_id, action: 'signed_returned',
      metadata: { sig_request_id, new_version: nextVer, hash },
    });

    return json(200, { ok: true, document_id: req0.alixdocs_document_id, new_version: nextVer });
  } catch (e: any) {
    return json(500, { error: e?.message ?? String(e) });
  }
});
