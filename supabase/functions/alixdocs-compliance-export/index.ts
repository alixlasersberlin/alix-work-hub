// AlixDocs Phase 14 — Compliance-Export (GoBD/DSGVO-konform)
// Erzeugt einen Manifest-JSON mit SHA-256 Prüfsummen aller Dokumente + Metadaten
// und signierte Download-URLs. Optional gefiltert nach Datum / Kategorie / Kunde.
// Nur Super Admin / Admin.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth) return json(401, { error: 'unauthorized' });

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const asUser = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: userRes } = await asUser.auth.getUser();
    const user = userRes?.user;
    if (!user) return json(401, { error: 'unauthorized' });

    // Rolle prüfen
    const { data: hasSuper } = await asUser.rpc('has_role', { _user_id: user.id, _role: 'Super Admin' });
    const { data: hasAdmin } = await asUser.rpc('has_role', { _user_id: user.id, _role: 'Admin' });
    if (!hasSuper && !hasAdmin) return json(403, { error: 'forbidden' });

    const body = await req.json().catch(() => ({}));
    const { date_from, date_to, category, customer_id, include_urls = true } = body;

    const admin = createClient(url, svc);
    let q = admin.from('alixdocs_documents').select('id,title,category,customer_id,order_id,current_version,created_at,updated_at,confidentiality_level,retention_until,mime_type');
    if (date_from) q = q.gte('created_at', date_from);
    if (date_to) q = q.lte('created_at', date_to);
    if (category) q = q.eq('category', category);
    if (customer_id) q = q.eq('customer_id', customer_id);
    const { data: docs, error } = await q.order('created_at', { ascending: true }).limit(5000);
    if (error) throw error;

    const items: any[] = [];
    for (const d of docs ?? []) {
      const { data: ver } = await admin.from('alixdocs_versions')
        .select('storage_bucket, storage_path, file_hash, file_size, mime_type, original_filename')
        .eq('document_id', d.id).eq('version_number', d.current_version).maybeSingle();
      let signedUrl: string | null = null;
      if (include_urls && ver?.storage_bucket && ver.storage_path) {
        const { data: sig } = await admin.storage.from(ver.storage_bucket).createSignedUrl(ver.storage_path, 60 * 60 * 24 * 7);
        signedUrl = sig?.signedUrl ?? null;
      }
      items.push({
        document_id: d.id,
        title: d.title,
        category: d.category,
        customer_id: d.customer_id,
        order_id: d.order_id,
        confidentiality: d.confidentiality_level,
        retention_until: d.retention_until,
        current_version: d.current_version,
        created_at: d.created_at,
        updated_at: d.updated_at,
        file: ver ? {
          filename: ver.original_filename,
          size_bytes: ver.file_size,
          mime: ver.mime_type,
          sha256: ver.file_hash,
          storage_path: `${ver.storage_bucket}/${ver.storage_path}`,
          signed_url: signedUrl,
          signed_url_expires_in_days: signedUrl ? 7 : null,
        } : null,
      });
    }

    // Manifest-Hash bilden (Kette aller SHA-256)
    const enc = new TextEncoder();
    const chain = items.map(i => `${i.document_id}:${i.file?.sha256 ?? ''}`).join('|');
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(chain));
    const manifest_hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Audit-Eintrag
    await admin.from('alixdocs_audit_log').insert({
      user_id: user.id, action: 'compliance_export',
      metadata: { filters: { date_from, date_to, category, customer_id }, count: items.length, manifest_hash },
    });

    const manifest = {
      generated_at: new Date().toISOString(),
      generated_by: user.email,
      standard: 'GoBD / DSGVO',
      filters: { date_from, date_to, category, customer_id },
      document_count: items.length,
      manifest_hash,
      items,
    };
    return json(200, manifest);
  } catch (e: any) {
    return json(500, { error: e?.message ?? String(e) });
  }
});
