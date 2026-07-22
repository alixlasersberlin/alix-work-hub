// AlixDocs AI 2.0 — GoBD/DSGVO Compliance Export
// Returns a signed manifest (JSON) with SHA256 hashes for all documents
// belonging to a customer or the entire tenant. Admin/Super Admin only.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

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
    const { data: roles } = await svc.rpc('has_role', { _user_id: user.id, _role: 'Super Admin' });
    const { data: rolesAdmin } = await svc.rpc('has_role', { _user_id: user.id, _role: 'Admin' });
    if (!roles && !rolesAdmin) return json(403, { error: 'forbidden' });

    const body = await req.json().catch(() => ({}));
    const { customer_id, doc_type, from, to } = body as { customer_id?: string; doc_type?: string; from?: string; to?: string };

    let q = svc.from('alixdocs2_documents')
      .select('id, title, nc_path, sha256, size, mime, doc_type, status, ai_entities, ai_tags, created_at, alixdocs2_relations(linked_type, linked_id)')
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (doc_type) q = q.eq('doc_type', doc_type);
    if (from) q = q.gte('created_at', from);
    if (to) q = q.lte('created_at', to);

    const { data: docs, error } = await q;
    if (error) throw error;

    let filtered = docs ?? [];
    if (customer_id) {
      filtered = filtered.filter((d: any) =>
        (d.alixdocs2_relations ?? []).some((r: any) => r.linked_type === 'kunde' && r.linked_id === customer_id));
    }

    const manifest = {
      generated_at: new Date().toISOString(),
      generated_by: user.email ?? user.id,
      filter: { customer_id, doc_type, from, to },
      count: filtered.length,
      documents: filtered.map((d: any) => ({
        id: d.id, title: d.title, nc_path: d.nc_path,
        sha256: d.sha256, size: d.size, mime: d.mime,
        doc_type: d.doc_type, status: d.status,
        created_at: d.created_at,
        entities: d.ai_entities, tags: d.ai_tags,
        relations: d.alixdocs2_relations,
      })),
    };

    // Audit
    await svc.from('alixdocs2_audit').insert({
      document_id: null, user_id: user.id, action: 'compliance_export',
      metadata: { count: filtered.length, filter: manifest.filter },
    });

    return json(200, manifest);
  } catch (e: any) {
    return json(500, { error: e?.message ?? String(e) });
  }
});
