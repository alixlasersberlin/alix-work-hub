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
      .select('id, title, category_id, retention_until, status, legal_hold')
      .lte('retention_until', today)
      .neq('status', 'archiviert')
      .is('deleted_at', null)
      .limit(500);

    let archived = 0;
    for (const d of expired ?? []) {
      if (d.legal_hold) continue;
      await svc.from('alixdocs_documents').update({ status: 'archiviert' }).eq('id', d.id);
      await svc.from('alixdocs_audit_log').insert({
        document_id: d.id, action: 'retention_archived',
        metadata: { retention_until: d.retention_until },
      });
      archived++;
    }

    // 2. Auto soft-delete archived docs older than category.delete_after_archive_days
    const { data: cats } = await svc.from('alixdocs_categories')
      .select('id, code, delete_after_archive_days')
      .not('delete_after_archive_days', 'is', null);

    let deleted = 0;
    for (const c of cats ?? []) {
      const days = Number((c as any).delete_after_archive_days);
      if (!days || days <= 0) continue;
      const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
      const { data: toDel } = await svc.from('alixdocs_documents')
        .select('id, title, legal_hold, updated_at')
        .eq('category_id', (c as any).id)
        .eq('status', 'archiviert')
        .is('deleted_at', null)
        .lte('updated_at', cutoff)
        .limit(500);
      for (const d of toDel ?? []) {
        if ((d as any).legal_hold) continue;
        await svc.from('alixdocs_documents').update({
          deleted_at: new Date().toISOString(),
          status: 'geloescht',
        }).eq('id', (d as any).id);
        await svc.from('alixdocs_audit_log').insert({
          document_id: (d as any).id, action: 'retention_deleted',
          metadata: { after_archive_days: days, category_code: (c as any).code },
        });
        deleted++;
      }
    }

    // 3. Warn admins about docs expiring in next 30 days
    const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    const { data: soon } = await svc.from('alixdocs_documents')
      .select('id, title, retention_until, uploaded_by')
      .gt('retention_until', today)
      .lte('retention_until', in30)
      .is('deleted_at', null)
      .limit(200);

    let ownerMails = 0;
    if ((soon ?? []).length > 0) {
      const { data: admins } = await svc.from('user_roles').select('user_id').in('role' as any, ['Admin', 'Super Admin']);
      const adminIds = Array.from(new Set((admins ?? []).map((a: any) => a.user_id)));

      // Group by owner for one email per owner
      const perOwner = new Map<string, any[]>();
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
        if ((d as any).uploaded_by) {
          const k = (d as any).uploaded_by as string;
          if (!perOwner.has(k)) perOwner.set(k, []);
          perOwner.get(k)!.push(d);
        }
      }

      // Owner email warnings (one summary per owner, once per doc/day via audit dedupe)
      for (const [ownerId, docs] of perOwner) {
        const { data: prof } = await svc.from('user_profiles').select('email').eq('id', ownerId).maybeSingle();
        const to = (prof as any)?.email;
        if (!to) continue;

        // dedupe: skip if we warned this owner today
        const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
        const { data: already } = await svc.from('alixdocs_audit_log')
          .select('id').eq('action', 'retention_owner_warned')
          .gte('created_at', startOfDay.toISOString())
          .contains('metadata', { owner_id: ownerId }).limit(1);
        if ((already ?? []).length > 0) continue;

        const rows = docs.map((d) =>
          `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${d.title}</td>` +
          `<td style="padding:6px 10px;border-bottom:1px solid #eee">${d.retention_until}</td></tr>`
        ).join('');
        const html =
          `<h2>AlixDocs – Aufbewahrungsfrist läuft ab</h2>` +
          `<p>Folgende ${docs.length} Dokument(e) laufen in den nächsten 30 Tagen aus:</p>` +
          `<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">` +
          `<thead><tr><th style="text-align:left;padding:6px 10px;border-bottom:2px solid #333">Titel</th>` +
          `<th style="text-align:left;padding:6px 10px;border-bottom:2px solid #333">Frist</th></tr></thead>` +
          `<tbody>${rows}</tbody></table>` +
          `<p style="margin-top:16px"><a href="https://app.alixwork.de/dokumente">In AlixDocs öffnen</a></p>`;

        try {
          await svc.functions.invoke('send-transactional-email', {
            body: {
              to,
              subject: `AlixDocs: ${docs.length} Dokument(e) laufen bald ab`,
              html,
              category: 'alixdocs_retention',
            },
          });
          ownerMails++;
          await svc.from('alixdocs_audit_log').insert({
            action: 'retention_owner_warned',
            metadata: { owner_id: ownerId, count: docs.length },
          });
        } catch (_) { /* soft-fail */ }
      }
    }

    return json(200, { ok: true, archived, deleted, warned: (soon ?? []).length });
  } catch (e: any) {
    return json(500, { error: e?.message ?? String(e) });
  }
});
