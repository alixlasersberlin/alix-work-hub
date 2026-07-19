// AlixDocs — Attach an existing storage object (Mail attachment / generated PDF) as an AlixDocs document.
// Input JSON: { source_bucket, source_path, order_id?, customer_id?, category_code?, title?,
//               confidentiality_level?, source? ('mail_attachment' | 'auto_pdf' | 'zoho' | 'signature') }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-alix-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const TARGET_BUCKET = 'alixdocs-private';

function sanitizeName(name: string) {
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const sharedKey = Deno.env.get('ALIXWORK_SHARED_KEY') ?? '';

  // Auth: either a signed-in user OR a valid x-alix-key (server-to-server from other edge fns)
  let userId: string | null = null;
  const authHeader = req.headers.get('Authorization') ?? '';
  const alixKey = req.headers.get('x-alix-key') ?? '';
  if (alixKey && sharedKey && alixKey === sharedKey) {
    userId = null; // system
  } else if (authHeader) {
    const uc = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data } = await uc.auth.getUser();
    if (!data?.user) return json(401, { error: 'unauthorized' });
    userId = data.user.id;
  } else {
    return json(401, { error: 'missing_auth' });
  }

  const body = await req.json().catch(() => ({}));
  const source_bucket = body.source_bucket as string;
  const source_path = body.source_path as string;
  const order_id = body.order_id ?? null;
  const customer_id = body.customer_id ?? null;
  const category_code = (body.category_code as string) || 'sonstiges';
  const title = (body.title as string) || null;
  const description = (body.description as string) || null;
  const confidentiality_level = (body.confidentiality_level as string) || 'normal';
  const source = (body.source as string) || 'mail_attachment';

  if (!source_bucket || !source_path) return json(400, { error: 'source_bucket_and_path_required' });

  const admin = createClient(supabaseUrl, serviceKey);

  // Download source file
  const { data: blob, error: dlErr } = await admin.storage.from(source_bucket).download(source_path);
  if (dlErr || !blob) return json(404, { error: 'source_download_failed', details: dlErr?.message });

  const buf = await blob.arrayBuffer();
  const mime = blob.type || 'application/octet-stream';
  const size = buf.byteLength;
  const hash = await sha256(buf);
  const origName = source_path.split('/').pop() ?? 'datei';
  const safe = sanitizeName(origName);

  // Category lookup
  const { data: cat } = await admin.from('alixdocs_categories').select('id').eq('code', category_code).maybeSingle();

  // Duplicate check: same order + same hash → skip
  if (order_id) {
    const { data: existing } = await admin
      .from('alixdocs_versions')
      .select('document_id, alixdocs_documents!inner(order_id, deleted_at)')
      .eq('file_hash', hash)
      .limit(1);
    const match = (existing ?? []).find((r: any) => r.alixdocs_documents?.order_id === order_id && !r.alixdocs_documents?.deleted_at);
    if (match) return json(200, { ok: true, duplicate: true, document_id: match.document_id });
  }

  const { data: docRow, error: insErr } = await admin.from('alixdocs_documents').insert({
    order_id, customer_id,
    category_id: cat?.id ?? null,
    title: title || origName,
    description,
    mime_type: mime, file_size: size,
    original_filename: origName,
    current_version: 1,
    confidentiality_level,
    uploaded_by: userId,
    source,
  }).select('id').single();
  if (insErr) return json(500, { error: 'insert_failed', details: insErr.message });

  const storagePath = `docs/${docRow.id}/v1/${safe}`;
  const { error: upErr } = await admin.storage.from(TARGET_BUCKET)
    .upload(storagePath, new Uint8Array(buf), { contentType: mime, upsert: false });
  if (upErr) return json(500, { error: 'storage_upload_failed', details: upErr.message });

  const { error: vErr } = await admin.from('alixdocs_versions').insert({
    document_id: docRow.id, version_number: 1,
    storage_bucket: TARGET_BUCKET, storage_path: storagePath,
    file_hash: hash, file_size: size, mime_type: mime,
    original_filename: origName, uploaded_by: userId,
    change_note: source === 'mail_attachment' ? 'Aus MailCenter angeheftet' : 'Automatisch abgelegt',
  });
  if (vErr) return json(500, { error: 'version_insert_failed', details: vErr.message });

  await admin.from('alixdocs_audit_log').insert({
    document_id: docRow.id, user_id: userId,
    action: 'attached', metadata: { source, source_bucket, source_path, hash, size },
    user_agent: req.headers.get('user-agent'),
  });

  return json(200, { ok: true, document_id: docRow.id });
});
