// AlixDocs — Dashboard Aggregate
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};
function json(s: number, b: unknown) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json(401, { error: 'missing_auth' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json(401, { error: 'unauthorized' });

  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, service);

  const nowIso = new Date().toISOString();
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const since90 = new Date(Date.now() - 90 * 86400000).toISOString();

  const [tot, del, m30, expSoon, pending, byStatus, byCat, byMonth, bySource, storage] = await Promise.all([
    admin.from('alixdocs_documents').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    admin.from('alixdocs_documents').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null),
    admin.from('alixdocs_documents').select('id', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', since30),
    admin.from('alixdocs_documents').select('id, title, expiry_date').is('deleted_at', null).not('expiry_date', 'is', null).lte('expiry_date', new Date(Date.now() + 60 * 86400000).toISOString()).order('expiry_date').limit(20),
    admin.from('alixdocs_approval_states').select('id, document_id, step_index, created_at').eq('status', 'ausstehend').order('created_at').limit(20),
    admin.from('alixdocs_documents').select('status').is('deleted_at', null).limit(10000),
    admin.from('alixdocs_documents').select('category_id').is('deleted_at', null).limit(10000),
    admin.from('alixdocs_documents').select('created_at').is('deleted_at', null).gte('created_at', since90).limit(10000),
    admin.from('alixdocs_documents').select('source').is('deleted_at', null).limit(10000),
    admin.from('alixdocs_versions').select('file_size').limit(20000),
  ]);

  const bucketBy = <T extends string | null>(rows: any[], key: string) => {
    const m = new Map<T, number>();
    for (const r of rows || []) { const k = (r?.[key] ?? null) as T; m.set(k, (m.get(k) ?? 0) + 1); }
    return Array.from(m.entries()).map(([k, v]) => ({ key: k, count: v })).sort((a,b) => b.count - a.count);
  };
  const monthly = new Map<string, number>();
  for (const r of byMonth.data || []) {
    const k = String((r as any).created_at).slice(0, 7);
    monthly.set(k, (monthly.get(k) ?? 0) + 1);
  }
  const totalBytes = (storage.data || []).reduce((a: number, r: any) => a + Number(r.file_size ?? 0), 0);

  const { data: cats } = await admin.from('alixdocs_categories').select('id, code, name');
  const catMap = new Map((cats || []).map(c => [c.id, c]));

  return json(200, {
    generated_at: nowIso,
    totals: {
      documents: tot.count ?? 0,
      trashed: del.count ?? 0,
      last_30_days: m30.count ?? 0,
      total_bytes: totalBytes,
    },
    expiring_soon: (expSoon.data || []).map((r: any) => ({ id: r.id, title: r.title, expiry_date: r.expiry_date })),
    pending_approvals: (pending.data || []),
    by_status: bucketBy(byStatus.data || [], 'status'),
    by_category: bucketBy(byCat.data || [], 'category_id').map(x => ({ ...x, name: catMap.get(x.key as string)?.name ?? '—' })),
    by_source: bucketBy(bySource.data || [], 'source'),
    by_month: Array.from(monthly.entries()).sort().map(([month, count]) => ({ month, count })),
  });
});
