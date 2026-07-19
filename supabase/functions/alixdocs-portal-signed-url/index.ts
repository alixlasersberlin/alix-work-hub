import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Portal-User lädt ein für ihn freigegebenes AlixDocs-Dokument
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (s: number, b: unknown) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth) return json(401, { error: 'unauthorized' });

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const asUser = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: userRes } = await asUser.auth.getUser();
    const user = userRes?.user;
    if (!user) return json(401, { error: 'unauthorized' });

    const { share_id } = await req.json();
    if (!share_id) return json(400, { error: 'share_id required' });

    const svc = createClient(url, service);
    const { data: pu } = await svc.from('customer_portal_users').select('customer_id').eq('user_id', user.id).maybeSingle();
    if (!pu?.customer_id) return json(403, { error: 'kein Portal-Zugang' });

    const { data: share } = await svc.from('alixdocs_portal_shares').select('*').eq('id', share_id).eq('customer_id', pu.customer_id).is('revoked_at', null).maybeSingle();
    if (!share) return json(404, { error: 'nicht gefunden oder widerrufen' });
    if (share.expires_at && new Date(share.expires_at) < new Date()) return json(410, { error: 'Freigabe abgelaufen' });

    const { data: doc } = await svc.from('alixdocs_documents').select('current_version, mime_type').eq('id', share.document_id).single();
    const { data: ver } = await svc.from('alixdocs_versions').select('storage_path').eq('document_id', share.document_id).eq('version_number', doc!.current_version).single();

    const { data: signed, error: sErr } = await svc.storage.from('alixdocs-private').createSignedUrl(ver!.storage_path, 600);
    if (sErr) throw sErr;

    await svc.from('alixdocs_portal_shares').update({
      download_count: (share.download_count ?? 0) + 1, last_accessed_at: new Date().toISOString(),
    }).eq('id', share_id);
    await svc.from('alixdocs_audit_log').insert({
      document_id: share.document_id, user_id: user.id, action: 'portal_download', metadata: { share_id },
    });

    return json(200, { url: signed.signedUrl, mime_type: doc!.mime_type });
  } catch (e: any) {
    return json(500, { error: e?.message ?? String(e) });
  }
});
