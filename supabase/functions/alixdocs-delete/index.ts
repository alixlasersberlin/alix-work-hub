// AlixDocs — Soft-Delete (Papierkorb 30 Tage) oder Restore
import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { documentOperationAllowed, ownDocumentStorage } from '../_shared/document-operation.ts';
import { z } from 'npm:zod@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const access = await requireCallerAccess(req, corsHeaders);
  if ('response' in access) return access.response;
  const { data: staff, error: staffError } = await access.caller.rpc('is_internal_staff');
  if (staffError || staff !== true) return json(403, { error: 'document_access_denied' });
  const userClient = access.caller;
  const userId = access.user.id;
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
  const parsed = z.object({ document_id: z.string().uuid(), action: z.enum(['soft_delete', 'restore', 'purge']).default('soft_delete') }).strict().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'invalid_document_operation' });
  const { document_id, action } = parsed.data;
  if (action !== 'restore' && !access.roles.includes('Super Admin')) return json(403, { error: 'Super Admin required' });
  const { data: doc, error: docError } = await admin.from('alixdocs_documents').select('id,uploaded_by,tenant_id,order_id,customer_id,legal_hold').eq('id', document_id).maybeSingle();
  if (docError || !doc) return json(404, { error: 'document_not_found' });
  if (!documentOperationAllowed(access.roles, userId, doc.uploaded_by, action)) return json(403, { error: 'document_operation_denied' });
  if (doc.tenant_id && !access.tenants.some(t => t.id === doc.tenant_id)) return json(403, { error: 'document_company_denied' });
  let companyConfirmed = !!doc.tenant_id;
  for (const [table, id] of [['orders', doc.order_id], ['customers', doc.customer_id]] as const) {
    if (!id) continue;
    const { data: parent, error } = await userClient.from(table).select('id,source_system').eq('id', id).maybeSingle();
    if (error || !parent || !access.tenants.some(t => t.zoho_source_system === parent.source_system)) return json(403, { error: 'document_parent_denied' });
    companyConfirmed = true;
  }
  if (!companyConfirmed && doc.uploaded_by !== userId) return json(403, { error: 'document_scope_unconfirmed' });
  if (action === 'purge' && doc.legal_hold) return json(409, { error: 'document_legal_hold' });

  // Only Super Admin can purge
  if (action === 'purge') {

    // Load versions to remove from storage
    const { data: vers, error: versionsError } = await admin.from('alixdocs_versions')
      .select('storage_bucket, storage_path').eq('document_id', document_id);
    if (versionsError) return json(500, { error: 'versions_read_failed' });
    if ((vers ?? []).some(v => !ownDocumentStorage(v.storage_bucket, v.storage_path, document_id))) return json(409, { error: 'document_storage_scope_unconfirmed' });
    // Hidden trash rows are not selectable under normal read policies. The
    // active exact-Super-Admin and company checks above authorize this existing
    // privileged operation; database guards run before irreversible file removal.
    const { data: removed, error: deleteError } = await admin.from('alixdocs_documents').delete().eq('id', document_id).select('id');
    if (deleteError || !removed?.length) return json(409, { error: 'document_delete_denied' });
    if (vers && vers.length) {
      const byBucket: Record<string, string[]> = {};
      for (const v of vers) (byBucket[v.storage_bucket] ??= []).push(v.storage_path);
      for (const [bucket, paths] of Object.entries(byBucket)) {
        const { error: storageError } = await admin.storage.from(bucket).remove(paths);
        if (storageError) return json(500, { error: 'document_removed_storage_cleanup_failed' });
      }
    }
    await admin.from('alixdocs_audit_log').insert({
      document_id, user_id: userId, action: 'purged', metadata: {}, user_agent: req.headers.get('user-agent'),
    });
    return json(200, { ok: true, action: 'purged' });
  }

  const now = new Date();
  const patch = action === 'restore'
    ? { deleted_at: null, purge_after: null }
    : { deleted_at: now.toISOString(), purge_after: new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString() };

  const { data: changed, error } = await admin.from('alixdocs_documents').update(patch).eq('id', document_id).select('id');
  if (error || !changed?.length) return json(500, { error: 'update_failed', details: error?.message });

  await admin.from('alixdocs_audit_log').insert({
    document_id, user_id: userId, action: action === 'restore' ? 'restored' : 'soft_deleted',
    metadata: {}, user_agent: req.headers.get('user-agent'),
  });

  return json(200, { ok: true, action });
});
