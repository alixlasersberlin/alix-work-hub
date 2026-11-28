// AlixDocs — Upload / New Version
// Erwartet multipart/form-data: file, order_id?, customer_id?, device_id?, serial_number?,
// category_code, title?, description?, document_date?, confidentiality_level?,
// existing_document_id? (für neue Version), change_note?
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { z } from 'npm:zod@3.25.76';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]);
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
const BUCKET = 'alixdocs-private';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitizeName(name: string): string {
  const base = (name || 'datei').split(/[\\/]/).pop() ?? 'datei';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'datei';
}

async function sha256(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const access = await requireCallerAccess(req, corsHeaders);
  if ('response' in access) return access.response;
  const { data: internal, error: staffError } = await access.caller.rpc('is_internal_staff');
  if (staffError || internal !== true) return json(403, { error: 'document_access_denied' });
  const userId = access.user.id;
  const admin = access.caller;

  let form: FormData;
  try { form = await req.formData(); }
  catch { return json(400, { error: 'invalid_form_data' }); }

  const file = form.get('file');
  if (!(file instanceof File)) return json(400, { error: 'file_missing' });
  if (file.size > MAX_SIZE) return json(400, { error: 'file_too_large', max: MAX_SIZE });
  if (!ALLOWED_MIMES.has(file.type)) return json(400, { error: 'mime_not_allowed', mime: file.type });

  const order_id = (form.get('order_id') as string) || null;
  const customer_id = (form.get('customer_id') as string) || null;
  const device_id = (form.get('device_id') as string) || null;
  const serial_number = (form.get('serial_number') as string) || null;
  const category_code = (form.get('category_code') as string) || 'sonstiges';
  const title = (form.get('title') as string) || file.name;
  const description = (form.get('description') as string) || null;
  const document_date = (form.get('document_date') as string) || null;
  const confidentiality_level = (form.get('confidentiality_level') as string) || 'normal';
  const existing_document_id = (form.get('existing_document_id') as string) || null;
  const change_note = (form.get('change_note') as string) || null;
  const identifiers = z.object({ order_id: z.string().uuid().nullable(), customer_id: z.string().uuid().nullable(), device_id: z.string().uuid().nullable(), existing_document_id: z.string().uuid().nullable() }).safeParse({ order_id, customer_id, device_id, existing_document_id });
  if (!identifiers.success || !['normal', 'vertraulich', 'streng_vertraulich'].includes(confidentiality_level) || typeof title !== 'string' || title.length > 500 || typeof category_code !== 'string' || category_code.length > 100) return json(400, { error: 'invalid_document_fields' });
  let tenantId: string | null = null;
  // Existing versions use only stored parents, never identities submitted alongside the file.
  let existing: any = null;
  if (existing_document_id) {
    const { data: doc, error } = await admin.from('alixdocs_documents').select('id,current_version,order_id,customer_id,device_id,tenant_id,uploaded_by').eq('id', existing_document_id).maybeSingle();
    if (error || !doc) return json(404, { error: 'document_not_found' });
    if (doc.uploaded_by !== userId && !access.roles.some((role) => ['Super Admin', 'Admin', 'Geschäftsführung', 'Buchhaltung', 'Order'].includes(role))) return json(403, { error: 'document_update_denied' });
    if (doc.tenant_id && !access.tenants.some((tenant: any) => tenant.id === doc.tenant_id)) return json(403, { error: 'document_company_denied' });
    tenantId = doc.tenant_id;
    existing = doc;
  }
  for (const [table, parentId] of [['orders', existing ? existing.order_id : order_id], ['customers', existing ? existing.customer_id : customer_id], ['lager_devices', existing ? existing.device_id : device_id]] as const) {
    if (!parentId) continue;
    const { data: parent, error } = await admin.from(table).select('id,source_system').eq('id', parentId).maybeSingle();
    const tenant = access.tenants.find((t: any) => t.zoho_source_system && t.zoho_source_system === parent?.source_system);
    if (error || !parent || !tenant || (tenantId && tenantId !== tenant.id)) return json(403, { error: 'document_parent_scope_denied' });
    tenantId = tenant.id;
  }

  // Load category
  const { data: cat } = await admin.from('alixdocs_categories').select('id').eq('code', category_code).maybeSingle();
  const category_id = cat?.id ?? null;

  const buf = await file.arrayBuffer();
  const hash = await sha256(buf);
  const sanitized = sanitizeName(file.name);

  let documentId = existing_document_id;
  let versionNumber = 1;

  if (existing_document_id) {
    versionNumber = (existing?.current_version ?? 1) + 1;
  } else {
    // Parent checks plus caller-scoped insertion must succeed before private storage access.
    const { data: inserted, error: insErr } = await admin.from('alixdocs_documents').insert({
      order_id, customer_id, device_id, serial_number, category_id,
      tenant_id: tenantId,
      title, description, document_date,
      mime_type: file.type, file_size: file.size,
      original_filename: file.name,
      current_version: 1,
      confidentiality_level,
      uploaded_by: userId,
    }).select('id').single();
    if (insErr || !inserted) return json(403, { error: 'document_insert_denied' });
    documentId = inserted.id;
  }

  // Path: docs/{document_id}/v{n}/{name}
  const storagePath = `docs/${documentId}/v${versionNumber}/${sanitized}`;

  const storage = createClient(supabaseUrl, serviceKey);
  const { error: upErr } = await storage.storage.from(BUCKET)
    .upload(storagePath, new Uint8Array(buf), {
      contentType: file.type,
      upsert: false,
    });
  if (upErr) return json(500, { error: 'storage_upload_failed', details: upErr.message });

  const { error: verErr } = await admin.from('alixdocs_versions').insert({
    document_id: documentId,
    version_number: versionNumber,
    storage_bucket: BUCKET,
    storage_path: storagePath,
    file_hash: hash,
    file_size: file.size,
    mime_type: file.type,
    original_filename: file.name,
    change_note,
    uploaded_by: userId,
  });
  if (verErr) return json(500, { error: 'version_insert_failed', details: verErr.message });

  if (existing_document_id) {
    const { error: updateError } = await admin.from('alixdocs_documents').update({
      current_version: versionNumber,
      mime_type: file.type,
      file_size: file.size,
      original_filename: file.name,
    }).eq('id', documentId).eq('current_version', existing?.current_version ?? 1).select('id').single();
    if (updateError) return json(409, { error: 'document_version_conflict' });
  }

  await admin.from('alixdocs_audit_log').insert({
    document_id: documentId, user_id: userId,
    action: existing_document_id ? 'version_created' : 'uploaded',
    metadata: { version: versionNumber, size: file.size, mime: file.type, hash },
    user_agent: req.headers.get('user-agent'),
  });

  // Fire-and-forget: KI-Analyse asynchron starten (blockiert Upload nicht)
  try {
    const kick = fetch(`${supabaseUrl}/functions/v1/alixdocs-ai-process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ document_id: documentId }),
    });
    // @ts-ignore Deno EdgeRuntime background task
    if (typeof EdgeRuntime !== 'undefined' && (EdgeRuntime as any).waitUntil) (EdgeRuntime as any).waitUntil(kick);
  } catch { /* ignore */ }

  return json(200, { ok: true, document_id: documentId, version: versionNumber });
});

