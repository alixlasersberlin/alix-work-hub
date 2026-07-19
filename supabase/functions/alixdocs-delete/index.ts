// AlixDocs — Soft-Delete (Papierkorb 30 Tage) oder Restore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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

  const admin = createClient(supabaseUrl, serviceKey);
  const body = await req.json().catch(() => ({}));
  const document_id = body.document_id as string;
  const action = (body.action as string) || 'soft_delete'; // soft_delete | restore | purge

  if (!document_id) return json(400, { error: 'document_id_required' });

  // Only Super Admin can purge
  if (action === 'purge') {
    const { data: isSA } = await userClient.rpc('has_role', { check_role: 'Super Admin' });
    if (!isSA) return json(403, { error: 'forbidden' });

    // Load versions to remove from storage
    const { data: vers } = await admin.from('alixdocs_versions')
      .select('storage_bucket, storage_path').eq('document_id', document_id);
    if (vers && vers.length) {
      const byBucket: Record<string, string[]> = {};
      for (const v of vers) (byBucket[v.storage_bucket] ??= []).push(v.storage_path);
      for (const [bucket, paths] of Object.entries(byBucket)) {
        await admin.storage.from(bucket).remove(paths);
      }
    }
    await admin.from('alixdocs_documents').delete().eq('id', document_id);
    await admin.from('alixdocs_audit_log').insert({
      document_id, user_id: userId, action: 'purged', metadata: {}, user_agent: req.headers.get('user-agent'),
    });
    return json(200, { ok: true, action: 'purged' });
  }

  const now = new Date();
  const patch = action === 'restore'
    ? { deleted_at: null, purge_after: null }
    : { deleted_at: now.toISOString(), purge_after: new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString() };

  const { error } = await admin.from('alixdocs_documents').update(patch).eq('id', document_id);
  if (error) return json(500, { error: 'update_failed', details: error.message });

  await admin.from('alixdocs_audit_log').insert({
    document_id, user_id: userId, action: action === 'restore' ? 'restored' : 'soft_deleted',
    metadata: {}, user_agent: req.headers.get('user-agent'),
  });

  return json(200, { ok: true, action });
});
