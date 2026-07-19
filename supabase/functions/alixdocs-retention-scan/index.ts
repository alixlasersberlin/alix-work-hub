import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (s: number, b: unknown) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const svc = createClient(url, service);
    const today = new Date().toISOString().slice(0, 10);

    // 1. Auto-archive documents whose retention has passed
    const { data: expired } = await svc.from('alixdocs_documents')
      .select('id, title, category_id, retention_until, status')
      .lte('retention_until', today)
      .neq('status', 'archiviert')
      .is('deleted_at', null)
      .limit(500);

    let archived = 0;
    for (const d of expired ?? []) {
      await svc.from('alixdocs_documents').update({ status: 'archiviert' }).eq('id', d.id);
      await svc.from('alixdocs_audit_log').insert({ document_id: d.id, action: 'retention_archived', metadata: { retention_until: d.retention_until } });
      archived++;
    }

    // 2. Warn admins about docs expiring in next 30 days (skip if in query mode)
    const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    const { data: soon } = await svc.from('alixdocs_documents')
      .select('id, title, retention_until')
      .gt('retention_until', today)
      .lte('retention_until', in30)
      .is('deleted_at', null)
      .limit(200);

    // Notify Admin + Super Admin once per doc (dedupe by title-of-notification)
    if ((soon ?? []).length > 0) {
      const { data: admins } = await svc.from('user_roles').select('user_id').in('role' as any, ['Admin', 'Super Admin']);
      const adminIds = Array.from(new Set((admins ?? []).map((a: any) => a.user_id)));
      for (const d of soon ?? []) {
        for (const uid of adminIds) {
          await svc.from('app_notifications').insert({
            user_id: uid,
            title: 'AlixDocs Retention läuft ab',
            message: `„${d.title}" – Frist bis ${d.retention_until}`,
            category: 'alixdocs_retention',
            priority: 'medium',
            metadata: { document_id: d.id },
            action_url: `/dokumente?doc=${d.id}`,
          });
        }
      }
    }

    return json(200, { ok: true, archived, warned: (soon ?? []).length });
  } catch (e: any) {
    return json(500, { error: e?.message ?? String(e) });
  }
});
