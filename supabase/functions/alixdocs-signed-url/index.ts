// AlixDocs — Signed URL für eine Version
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json(401, { error: 'missing_auth' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json(401, { error: 'unauthorized' });
  const userId = userData.user.id;

  const body = await req.json().catch(() => ({}));
  const document_id = body.document_id as string | undefined;
  const version_number = body.version_number as number | undefined;
  if (!document_id) return json(400, { error: 'document_id_required' });

  // Use user client to enforce RLS on read of documents/versions
  const { data: doc } = await userClient.from('alixdocs_documents')
    .select('id, confidentiality_level, current_version').eq('id', document_id).maybeSingle();
  if (!doc) return json(404, { error: 'not_found_or_forbidden' });

  const version = version_number ?? doc.current_version;

  const { data: ver } = await userClient.from('alixdocs_versions')
    .select('storage_bucket, storage_path, mime_type, original_filename')
    .eq('document_id', document_id).eq('version_number', version).maybeSingle();
  if (!ver) return json(404, { error: 'version_not_found' });

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: signed, error: sErr } = await admin.storage.from(ver.storage_bucket)
    .createSignedUrl(ver.storage_path, 600 /* 10 min */);
  if (sErr || !signed?.signedUrl) return json(500, { error: 'signed_url_failed', details: sErr?.message });

  await admin.from('alixdocs_audit_log').insert({
    document_id, user_id: userId,
    action: 'signed_url_created',
    metadata: { version, mime: ver.mime_type },
    user_agent: req.headers.get('user-agent'),
  });

  return json(200, {
    ok: true,
    url: signed.signedUrl,
    mime_type: ver.mime_type,
    original_filename: ver.original_filename,
    expires_in: 600,
  });
});
