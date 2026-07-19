// AlixDocs Reindex — startet KI-Verarbeitung (OCR + Tags + Kategorien)
// für alle Dokumente ohne ai_processed_at. Batchweise, Admin only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth) return json(401, { error: 'missing_auth' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const user = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: u } = await user.auth.getUser();
  if (!u?.user) return json(401, { error: 'unauthorized' });

  const admin = createClient(url, svc);
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', u.user.id);
  const isAdmin = (roles ?? []).some((r: any) => r.role === 'Admin' || r.role === 'Super Admin');
  if (!isAdmin) return json(403, { error: 'forbidden' });

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 25, 100);
  const force = Boolean(body.force);

  let q = admin.from('alixdocs_documents')
    .select('id')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (!force) q = q.is('ai_processed_at', null);

  const { data: docs, error } = await q;
  if (error) return json(500, { error: error.message });

  const results: any[] = [];
  for (const d of docs ?? []) {
    try {
      const r = await fetch(`${url}/functions/v1/alixdocs-ai-process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ document_id: d.id }),
      });
      results.push({ id: d.id, status: r.status });
    } catch (e: any) {
      results.push({ id: d.id, error: String(e?.message || e) });
    }
    // kurze Pause gegen Rate-Limits
    await new Promise((r) => setTimeout(r, 400));
  }

  return json(200, { ok: true, processed: results.length, results });
});
