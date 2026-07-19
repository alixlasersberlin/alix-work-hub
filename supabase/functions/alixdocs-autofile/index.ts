// alixdocs-autofile: nimmt eine PDF/Bild als base64 entgegen und legt sie direkt in AlixDocs ab.
// Body: { content_base64, filename, mime_type, order_id?, customer_id?, category_code?, title?, source?, confidentiality_level? }
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
const sanitize = (n: string) => (n || 'datei').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'datei';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!;
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const shared = Deno.env.get('ALIXWORK_SHARED_KEY') ?? '';

  let userId: string | null = null;
  const auth = req.headers.get('Authorization') ?? '';
  const alixKey = req.headers.get('x-alix-key') ?? '';
  if (alixKey && shared && alixKey === shared) userId = null;
  else if (auth) {
    const c = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data } = await c.auth.getUser();
    if (!data?.user) return json(401, { error: 'unauthorized' });
    userId = data.user.id;
  } else return json(401, { error: 'missing_auth' });

  const b = await req.json().catch(() => ({}));
  const { content_base64, filename, mime_type, order_id = null, customer_id = null,
    category_code = 'sonstiges', title = null, source = 'auto_pdf', confidentiality_level = 'normal' } = b;
  if (!content_base64 || !filename || !mime_type) return json(400, { error: 'content_base64+filename+mime_type required' });

  const admin = createClient(url, svc);
  const bin = Uint8Array.from(atob(content_base64), c => c.charCodeAt(0));
  const buf = bin.buffer as ArrayBuffer;
  const size = bin.byteLength;
  const hash = await sha256(buf);
  const safe = sanitize(filename);

  // Dedupe per order
  if (order_id) {
    const { data: exist } = await admin.from('alixdocs_versions')
      .select('document_id, alixdocs_documents!inner(order_id, deleted_at)')
      .eq('file_hash', hash).limit(5);
    const dup = (exist ?? []).find((r: any) => r.alixdocs_documents?.order_id === order_id && !r.alixdocs_documents?.deleted_at);
    if (dup) return json(200, { ok: true, duplicate: true, document_id: dup.document_id });
  }

  const { data: cat } = await admin.from('alixdocs_categories').select('id').eq('code', category_code).maybeSingle();
  const { data: doc, error: dErr } = await admin.from('alixdocs_documents').insert({
    order_id, customer_id, category_id: cat?.id ?? null,
    title: title || filename, mime_type, file_size: size,
    original_filename: filename, current_version: 1,
    confidentiality_level, uploaded_by: userId, source,
  }).select('id').single();
  if (dErr) return json(500, { error: dErr.message });

  const path = `docs/${doc.id}/v1/${safe}`;
  const { error: upErr } = await admin.storage.from('alixdocs-private').upload(path, bin, { contentType: mime_type, upsert: false });
  if (upErr) return json(500, { error: upErr.message });

  await admin.from('alixdocs_versions').insert({
    document_id: doc.id, version_number: 1, storage_bucket: 'alixdocs-private',
    storage_path: path, file_hash: hash, file_size: size, mime_type,
    original_filename: filename, uploaded_by: userId, change_note: 'Automatisch abgelegt',
  });
  await admin.from('alixdocs_audit_log').insert({
    document_id: doc.id, user_id: userId, action: 'auto_filed', metadata: { source, hash, size },
  });

  return json(200, { ok: true, document_id: doc.id });
});
