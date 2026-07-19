// AlixDocs Duplicates — findet Dubletten anhand content_hash / duplicate_of
// sowie fuzzy nach Titel + Kunde. Admin only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function normTitle(t: string): string {
  return (t || '').toLowerCase().replace(/\.(pdf|jpg|jpeg|png|docx?|xlsx?)$/i, '')
    .replace(/[^a-z0-9äöüß]+/g, ' ').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

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

  const { data: docs, error } = await admin.from('alixdocs_documents')
    .select('id, title, customer_id, content_hash, file_size, created_at, duplicate_of')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) return json(500, { error: error.message });

  // Group by content_hash
  const byHash = new Map<string, any[]>();
  const byTitle = new Map<string, any[]>();
  for (const d of docs ?? []) {
    if (d.content_hash) {
      const k = d.content_hash;
      if (!byHash.has(k)) byHash.set(k, []);
      byHash.get(k)!.push(d);
    }
    const nt = normTitle(d.title);
    if (nt && d.customer_id) {
      const k = `${d.customer_id}::${nt}`;
      if (!byTitle.has(k)) byTitle.set(k, []);
      byTitle.get(k)!.push(d);
    }
  }

  const groups: any[] = [];
  for (const [k, arr] of byHash) {
    if (arr.length > 1) groups.push({ type: 'hash', key: k, count: arr.length, documents: arr });
  }
  for (const [k, arr] of byTitle) {
    if (arr.length > 1) {
      // nur wenn nicht schon per Hash gefasst
      const ids = new Set(arr.map((x) => x.id));
      const alreadyByHash = groups.some((g) => g.type === 'hash' && g.documents.some((d: any) => ids.has(d.id)));
      if (!alreadyByHash) groups.push({ type: 'title', key: k, count: arr.length, documents: arr });
    }
  }

  groups.sort((a, b) => b.count - a.count);
  return json(200, { ok: true, groups: groups.slice(0, 100), total_groups: groups.length });
});
