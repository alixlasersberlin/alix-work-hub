import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Listet AlixDocs, die explizit für den aufrufenden Portal-User (=Kunde) freigegeben wurden.
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

    const svc = createClient(url, service);

    // Portal user -> customer_id
    const { data: pu } = await svc.from('customer_portal_users').select('customer_id').eq('user_id', user.id).maybeSingle();
    if (!pu?.customer_id) return json(403, { error: 'kein Portal-Zugang' });

    const nowIso = new Date().toISOString();
    const { data: shares } = await svc
      .from('alixdocs_portal_shares')
      .select(`
        id, document_id, shared_at, expires_at, note,
        alixdocs_documents!inner ( id, title, mime_type, file_size, current_version, document_date, category_id )
      `)
      .eq('customer_id', pu.customer_id)
      .is('revoked_at', null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

    return json(200, { ok: true, shares: shares ?? [] });
  } catch (e: any) {
    return json(500, { error: e?.message ?? String(e) });
  }
});
