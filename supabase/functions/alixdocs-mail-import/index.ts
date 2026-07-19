// AlixDocs — Mail attachment -> AlixDocs
// Body: { mail_attachment_id: string, category_code?: string, order_id?: string, customer_id?: string, title?: string }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const BUCKET = 'alixdocs-private';
function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json(401, { error: 'unauthorized' });

  let body: any; try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  const attId = String(body?.mail_attachment_id || '');
  if (!attId) return json(400, { error: 'missing_attachment' });

  const admin = createClient(url, service);
  const { data: att, error: attErr } = await admin.from('mail_attachments').select('*').eq('id', attId).maybeSingle();
  if (attErr || !att) return json(404, { error: 'attachment_not_found' });

  const { data: blob, error: dlErr } = await admin.storage.from(att.storage_bucket).download(att.storage_path);
  if (dlErr || !blob) return json(500, { error: 'download_failed', detail: dlErr?.message });
  const ab = await blob.arrayBuffer();
  const hash = await sha256(ab);

  // Category resolution
  const catCode = body?.category_code || 'sonstiges';
  const { data: cat } = await admin.from('alixdocs_categories').select('id, code').eq('code', catCode).maybeSingle();

  // Storage path in alixdocs bucket
  const safeName = (att.file_name || 'anhang').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const path = `mail/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}_${safeName}`;
  const up = await admin.storage.from(BUCKET).upload(path, new Uint8Array(ab), {
    contentType: att.mime_type || 'application/octet-stream', upsert: false,
  });
  if (up.error) return json(500, { error: 'upload_failed', detail: up.error.message });

  const { data: doc, error: docErr } = await admin.from('alixdocs_documents').insert({
    title: body?.title || att.file_name || 'Mailanhang',
    original_filename: att.file_name,
    mime_type: att.mime_type || 'application/octet-stream',
    file_size: att.file_size ?? ab.byteLength,
    file_hash: hash,
    current_version: 1,
    status: 'entwurf',
    confidentiality_level: 'normal',
    category_id: cat?.id ?? null,
    order_id: body?.order_id ?? att.order_id ?? null,
    customer_id: body?.customer_id ?? att.customer_id ?? null,
    uploaded_by: u.user.id,
    source: 'mail_attachment',
    metadata: { mail_attachment_id: attId, message_id: att.message_id },
  }).select().single();
  if (docErr) {
    await admin.storage.from(BUCKET).remove([path]).catch(() => {});
    return json(500, { error: docErr.message });
  }

  await admin.from('alixdocs_versions').insert({
    document_id: doc.id, version_number: 1, storage_bucket: BUCKET, storage_path: path,
    file_size: att.file_size ?? ab.byteLength, mime_type: att.mime_type, file_hash: hash,
    uploaded_by: u.user.id, change_note: 'Import aus MailCenter',
  });
  await admin.from('alixdocs_audit_log').insert({
    document_id: doc.id, action: 'import_mail', user_id: u.user.id,
    details: { mail_attachment_id: attId },
  });

  return json(200, { document_id: doc.id });
});
