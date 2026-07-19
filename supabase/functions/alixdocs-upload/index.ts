// AlixDocs — Upload / New Version
// Erwartet multipart/form-data: file, order_id?, customer_id?, device_id?, serial_number?,
// category_code, title?, description?, document_date?, confidentiality_level?,
// existing_document_id? (für neue Version), change_note?
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
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
  if (!authHeader) return json(401, { error: 'missing_auth' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: 'unauthorized' });
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey);

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

  // Load category
  const { data: cat } = await admin.from('alixdocs_categories').select('id').eq('code', category_code).maybeSingle();
  const category_id = cat?.id ?? null;

  const buf = await file.arrayBuffer();
  const hash = await sha256(buf);
  const sanitized = sanitizeName(file.name);

  let documentId = existing_document_id;
  let versionNumber = 1;

  if (existing_document_id) {
    const { data: doc, error: docErr } = await admin.from('alixdocs_documents')
      .select('id, current_version, order_id, customer_id').eq('id', existing_document_id).maybeSingle();
    if (docErr || !doc) return json(404, { error: 'document_not_found' });
    versionNumber = (doc.current_version ?? 1) + 1;
  } else {
    // Create the document row (service role bypasses RLS but we set uploaded_by to actual user)
    const { data: inserted, error: insErr } = await admin.from('alixdocs_documents').insert({
      order_id, customer_id, device_id, serial_number, category_id,
      title, description, document_date,
      mime_type: file.type, file_size: file.size,
      original_filename: file.name,
      current_version: 1,
      confidentiality_level,
      uploaded_by: userId,
    }).select('id').single();
    if (insErr) return json(500, { error: 'insert_failed', details: insErr.message });
    documentId = inserted.id;
  }

  // Path: docs/{document_id}/v{n}/{name}
  const storagePath = `docs/${documentId}/v${versionNumber}/${sanitized}`;

  const { error: upErr } = await admin.storage.from(BUCKET)
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
    await admin.from('alixdocs_documents').update({
      current_version: versionNumber,
      mime_type: file.type,
      file_size: file.size,
      original_filename: file.name,
    }).eq('id', documentId);
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

