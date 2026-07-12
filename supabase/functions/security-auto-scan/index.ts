import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const findings: Array<{
    category: string; target: string; severity: string; title: string; detail: string; recommendation: string; status: string;
  }> = [];

  // 1) Tables in public without RLS enabled
  const { data: noRls } = await supabase.rpc('exec_sql_readonly' as any, {}).catch(() => ({ data: null }));
  // Fallback: query via a definer helper we create in a migration, but simplest is to inline SQL via a dedicated RPC.
  // We instead use the built-in postgres_meta-like query via supabase.from on a view we create.

  const { data: rlsRows } = await (supabase as any).from('security_scan_tables_without_rls').select('*');
  (rlsRows ?? []).forEach((t: any) => {
    findings.push({
      category: 'rls', target: `${t.schemaname}.${t.tablename}`, severity: 'high',
      title: 'Tabelle ohne RLS', detail: 'Row-Level-Security ist auf dieser Tabelle nicht aktiviert.',
      recommendation: 'ALTER TABLE ... ENABLE ROW LEVEL SECURITY + Policies definieren.',
      status: 'open',
    });
  });

  // 2) Overly permissive policies (USING true)
  const { data: openPols } = await (supabase as any).from('security_scan_open_policies').select('*');
  (openPols ?? []).forEach((p: any) => {
    findings.push({
      category: 'rls', target: `${p.schemaname}.${p.tablename}.${p.policyname}`, severity: 'medium',
      title: 'Zu offene Policy', detail: `Policy erlaubt jedem authenticated Nutzer Zugriff (USING true) – cmd=${p.cmd}.`,
      recommendation: 'Policy an konkrete Rolle/Owner-Bedingung koppeln.',
      status: 'open',
    });
  });

  // 3) Public storage buckets
  const { data: pubBuckets } = await (supabase as any).from('security_scan_public_buckets').select('*');
  (pubBuckets ?? []).forEach((b: any) => {
    findings.push({
      category: 'storage', target: `bucket:${b.id}`, severity: 'high',
      title: 'Öffentlicher Storage-Bucket',
      detail: `Bucket "${b.id}" ist als public markiert.`,
      recommendation: 'Bucket auf privat setzen und signierte URLs verwenden.',
      status: 'open',
    });
  });

  // 4) SECURITY DEFINER functions without search_path
  const { data: badFn } = await (supabase as any).from('security_scan_functions_no_searchpath').select('*');
  (badFn ?? []).forEach((f: any) => {
    findings.push({
      category: 'functions', target: `public.${f.proname}(${f.args})`, severity: 'medium',
      title: 'Function ohne search_path',
      detail: 'SECURITY DEFINER Funktion ohne SET search_path.',
      recommendation: 'ALTER FUNCTION ... SET search_path = public.',
      status: 'open',
    });
  });

  // Upsert-style: mark previous auto-scan findings as resolved if not seen anymore
  await (supabase as any).from('security_audit_findings')
    .update({ status: 'resolved' })
    .eq('category', 'auto-scan-marker');

  // Insert a run marker
  const runAt = new Date().toISOString();
  await (supabase as any).from('security_audit_findings').insert({
    category: 'auto-scan-marker', target: 'scheduler', severity: 'info',
    title: `Auto-Scan Lauf ${runAt}`,
    detail: `${findings.length} potentielle Findings gefunden.`,
    recommendation: 'Details siehe Auto-Review Liste.',
    status: 'resolved',
  });

  if (findings.length) {
    // Insert only new ones (dedupe by category+target+title, open only)
    for (const f of findings) {
      const { data: existing } = await (supabase as any)
        .from('security_audit_findings')
        .select('id, status')
        .eq('category', f.category).eq('target', f.target).eq('title', f.title)
        .neq('status', 'resolved')
        .limit(1);
      if (!existing?.length) {
        await (supabase as any).from('security_audit_findings').insert(f);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, count: findings.length, ranAt: runAt }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
