// AlixDocs — Reporting & Audit Export (CSV)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : (v instanceof Date ? v.toISOString() : JSON.stringify(v));
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const head = headers.join(';');
  const body = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(';')).join('\n');
  return '\ufeff' + head + '\n' + body;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return new Response(JSON.stringify({ error: 'missing_auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });

  const admin = createClient(url, service);
  // Role check: Admin or Super Admin
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', u.user.id);
  const isAdmin = (roles ?? []).some((r: any) => r.role === 'Admin' || r.role === 'Super Admin');
  if (!isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: corsHeaders });

  const params = req.method === 'POST' ? await req.json().catch(() => ({})) : Object.fromEntries(new URL(req.url).searchParams);
  const kind: 'documents' | 'audit' = params.kind === 'audit' ? 'audit' : 'documents';
  const from = params.from as string | undefined;
  const to = params.to as string | undefined;
  const category = params.category as string | undefined;
  const status = params.status as string | undefined;

  if (kind === 'documents') {
    let q = admin.from('alixdocs_documents')
      .select('id, title, category_id, status, confidentiality_level, document_date, created_at, uploaded_by, mime_type, file_size, source, expiry_date, retention_until, legal_hold, deleted_at, order_id, customer_id, serial_number, tags')
      .order('created_at', { ascending: false })
      .limit(50000);
    if (from) q = q.gte('created_at', from);
    if (to) q = q.lte('created_at', to);
    if (category) q = q.eq('category_id', category);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

    // Enrich category names
    const catIds = [...new Set((data ?? []).map((d: any) => d.category_id).filter(Boolean))];
    const { data: cats } = await admin.from('alixdocs_categories').select('id, code, name').in('id', catIds.length ? catIds : ['00000000-0000-0000-0000-000000000000']);
    const catMap = new Map((cats ?? []).map((c: any) => [c.id, `${c.code} · ${c.name}`]));

    const rows = (data ?? []).map((d: any) => ({
      id: d.id,
      title: d.title,
      category: catMap.get(d.category_id) ?? '',
      status: d.status,
      confidentiality: d.confidentiality_level,
      document_date: d.document_date,
      created_at: d.created_at,
      mime_type: d.mime_type,
      file_size_kb: d.file_size ? Math.round(d.file_size / 1024) : '',
      source: d.source,
      expiry_date: d.expiry_date,
      retention_until: d.retention_until,
      legal_hold: d.legal_hold ? 'ja' : 'nein',
      deleted: d.deleted_at ? 'ja' : 'nein',
      order_id: d.order_id,
      customer_id: d.customer_id,
      serial_number: d.serial_number,
      tags: Array.isArray(d.tags) ? d.tags.join(',') : '',
    }));
    const csv = toCsv(rows, ['id','title','category','status','confidentiality','document_date','created_at','mime_type','file_size_kb','source','expiry_date','retention_until','legal_hold','deleted','order_id','customer_id','serial_number','tags']);

    // Audit-log the export
    await admin.from('alixdocs_audit_log').insert({ user_id: u.user.id, action: 'report_export_documents', metadata: { count: rows.length, from, to, category, status } });

    return new Response(csv, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="alixdocs-dokumente-${new Date().toISOString().slice(0,10)}.csv"` } });
  }

  // Audit CSV (GoBD-freundlich)
  let q = admin.from('alixdocs_audit_log')
    .select('id, created_at, user_id, action, document_id, ip, user_agent, metadata')
    .order('created_at', { ascending: false })
    .limit(100000);
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to);
  const { data, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  const userIds = [...new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean))];
  const { data: users } = await admin.from('user_profiles').select('id, email, full_name').in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
  const uMap = new Map((users ?? []).map((x: any) => [x.id, `${x.full_name ?? ''} <${x.email ?? ''}>`]));

  const rows = (data ?? []).map((r: any) => ({
    timestamp: r.created_at,
    user: uMap.get(r.user_id) ?? r.user_id ?? '',
    action: r.action,
    document_id: r.document_id ?? '',
    ip: r.ip ?? '',
    user_agent: r.user_agent ?? '',
    metadata: r.metadata ? JSON.stringify(r.metadata) : '',
  }));
  const csv = toCsv(rows, ['timestamp','user','action','document_id','ip','user_agent','metadata']);

  await admin.from('alixdocs_audit_log').insert({ user_id: u.user.id, action: 'report_export_audit', metadata: { count: rows.length, from, to } });

  return new Response(csv, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="alixdocs-audit-${new Date().toISOString().slice(0,10)}.csv"` } });
});
