// AlixDocs — DSGVO / Kunden-Komplettexport als ZIP
// Body: { customer_id: string }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import JSZip from 'https://esm.sh/jszip@3.10.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const BUCKET = 'alixdocs-private';
function json(s: number, b: unknown) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json(401, { error: 'missing_auth' });
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json(401, { error: 'unauthorized' });

  const b = await req.json().catch(() => ({}));
  const customerId = String(b?.customer_id || '');
  if (!customerId) return json(400, { error: 'missing_customer_id' });

  const admin = createClient(url, service);
  const { data: cust } = await admin.from('customers').select('id, name, customer_number').eq('id', customerId).maybeSingle();
  if (!cust) return json(404, { error: 'customer_not_found' });

  const { data: docs } = await admin.from('alixdocs_documents')
    .select('id, title, original_filename, current_version, mime_type, created_at, category_id, order_id, status')
    .eq('customer_id', customerId).is('deleted_at', null);

  const { data: cats } = await admin.from('alixdocs_categories').select('id, code, name');
  const catMap = new Map((cats || []).map(c => [c.id, c]));

  const zip = new JSZip();
  const idx: any[] = [];
  const used = new Set<string>();

  for (const d of docs || []) {
    const { data: v } = await admin.from('alixdocs_versions').select('storage_path')
      .eq('document_id', d.id).eq('version_number', d.current_version).maybeSingle();
    if (!v?.storage_path) continue;
    const { data: blob } = await admin.storage.from(BUCKET).download(v.storage_path);
    if (!blob) continue;
    const cat = d.category_id ? catMap.get(d.category_id) : null;
    const folder = cat?.name ? cat.name.replace(/[\\/:*?"<>|]/g, '_') : 'Sonstiges';
    let base = (d.original_filename || `${d.title}.pdf`).replace(/[\\/:*?"<>|]/g, '_');
    let path = `${folder}/${base}`; let n = 1;
    while (used.has(path)) { const dot = base.lastIndexOf('.'); path = `${folder}/${dot > 0 ? base.slice(0, dot) + '_' + n + base.slice(dot) : base + '_' + n}`; n++; }
    used.add(path);
    zip.file(path, new Uint8Array(await blob.arrayBuffer()));
    idx.push({ path, title: d.title, category: cat?.name, order_id: d.order_id, created_at: d.created_at, status: d.status });
  }

  zip.file('INDEX.json', JSON.stringify({
    customer: { id: cust.id, name: cust.name, customer_number: cust.customer_number },
    exported_at: new Date().toISOString(), exported_by: u.user.email,
    document_count: idx.length, documents: idx,
  }, null, 2));

  const out = await zip.generateAsync({ type: 'uint8array' });
  const fname = `alixdocs_kunde_${(cust.customer_number || cust.id).slice(0,20)}.zip`;
  return new Response(out, {
    headers: { ...corsHeaders, 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${fname}"` },
  });
});
