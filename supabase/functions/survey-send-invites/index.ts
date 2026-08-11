import "../_shared/global-bcc.ts";
// Versendet Umfrage-Einladungen und Erinnerungen an alle Empfänger einer Umfrage.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

function render(src: string, ctx: Record<string, string>) {
  return (src || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => ctx[k] ?? '');
}

function makeToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

    const token = auth.slice(7);
    const isSystem = token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    let userRes: { user: { id: string; email?: string | null } | null } = { user: null };
    if (isSystem) {
      userRes = { user: { id: '00000000-0000-0000-0000-000000000000', email: 'system@alixwork.de' } };
    } else {
      const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: auth } },
      });
      const res = await userClient.auth.getUser();
      userRes = { user: res.data?.user ?? null };
    }
    if (!userRes?.user) return json({ error: 'unauthorized' }, 401);

    const { survey_id, kind = 'einladung' } = await req.json().catch(() => ({}));
    if (!survey_id || typeof survey_id !== 'string') return json({ error: 'survey_id required' }, 400);
    if (!['einladung', 'erinnerung'].includes(String(kind))) return json({ error: 'invalid kind' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: survey } = await admin.from('surveys')
      .select('id, name, public_title, language, status, ends_at').eq('id', survey_id).maybeSingle();
    if (!survey) return json({ error: 'survey_not_found' }, 404);
    if (survey.status !== 'aktiv') return json({ error: 'survey_not_active' }, 400);

    const { data: recipients } = await admin.from('survey_recipients')
      .select('id, email, first_name, last_name, company_name, language, unsubscribed_at')
      .eq('survey_id', survey_id).is('unsubscribed_at', null);

    const { data: tpl } = await admin.from('survey_email_templates')
      .select('subject, body_html, from_name, reply_to')
      .eq('kind', kind).or(`survey_id.eq.${survey_id},survey_id.is.null`)
      .order('survey_id', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();

    // Öffentliche Links immer über die feste Produktions-Domain
    const origin = 'https://alixwork.de';
    const now = new Date().toISOString();
    let sent = 0, skipped = 0;

    for (const r of recipients ?? []) {
      if (!r.email) { skipped++; continue; }

      let { data: inv } = await admin.from('survey_invitations')
        .select('id, token, completed_at, sent_at, reminder_count')
        .eq('survey_id', survey_id).eq('recipient_id', r.id).maybeSingle();

      if (inv?.completed_at) { skipped++; continue; }
      if (kind === 'einladung' && inv?.sent_at) { skipped++; continue; }

      if (!inv) {
        const expires = survey.ends_at ?? new Date(Date.now() + 90 * 864e5).toISOString();
        const { data: created, error: invErr } = await admin.from('survey_invitations').insert({
          survey_id, recipient_id: r.id, token: makeToken(), expires_at: expires, status: 'neu',
        }).select('id, token, completed_at, sent_at, reminder_count').single();
        if (invErr) { skipped++; continue; }
        inv = created;
      }

      const link = `${origin}/umfrage/${inv.token}`;
      const ctx = {
        name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.company_name || 'Kunde',
        firma: r.company_name ?? '',
        link,
        umfrage: survey.public_title || survey.name,
      };

      const subject = tpl?.subject
        ? render(tpl.subject, ctx)
        : kind === 'einladung'
          ? `Ihre Meinung ist uns wichtig: ${ctx.umfrage}`
          : `Erinnerung: ${ctx.umfrage}`;

      const html = tpl?.body_html
        ? render(tpl.body_html, ctx)
        : `<p>Guten Tag ${ctx.name},</p>
           <p>wir möchten unsere Leistungen kontinuierlich verbessern und laden Sie ein, an unserer kurzen Umfrage teilzunehmen.</p>
           <p><a href="${link}">Umfrage jetzt starten</a></p>
           <p>Vielen Dank für Ihre Zeit.<br/>Ihr ALIX Team</p>`;

      const { data: log } = await admin.from('survey_email_logs').insert({
        survey_id, recipient_id: r.id, invitation_id: inv.id, kind, to_email: r.email,
        subject, status: 'queued', scheduled_at: now,
      }).select('id').single();

      let mailErr: { message: string } | null = null;
      try {
        const resendKey = Deno.env.get('RESEND_API_KEY');
        const lovableKey = Deno.env.get('LOVABLE_API_KEY');
        if (!resendKey) throw new Error('RESEND_API_KEY fehlt');
        if (!lovableKey) throw new Error('LOVABLE_API_KEY fehlt');
        const res = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            'X-Connection-Api-Key': resendKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: "Alix Lasers ® <noreply@alixlasers.ai>",
            bcc: ["service@alix-lasers.com"],
            reply_to: tpl?.reply_to || 'support@alix-operation.de',
            to: [r.email],
            subject,
            html,
          }),
        });
        if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
      } catch (e) {
        mailErr = { message: (e as Error).message };
      }

      if (mailErr) {
        await admin.from('survey_email_logs').update({ status: 'failed', error_text: mailErr.message }).eq('id', log?.id);
        skipped++;

        continue;
      }

      await admin.from('survey_email_logs').update({ status: 'sent', sent_at: now }).eq('id', log?.id);
      await admin.from('survey_invitations').update(
        kind === 'einladung'
          ? { sent_at: now, delivered_at: now, status: 'versendet' }
          : { last_reminder_at: now, reminder_count: (inv.reminder_count ?? 0) + 1 },
      ).eq('id', inv.id);
      sent++;
    }

    await admin.from('survey_audit_logs').insert({
      survey_id, entity_table: 'survey_invitations', action: kind === 'einladung' ? 'INVITES_SENT' : 'REMINDERS_SENT',
      new_value: { sent, skipped }, actor_id: isSystem ? null : userRes.user.id, actor_email: userRes.user.email,
    });

    return json({ ok: true, sent, skipped });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? 'error' }, 500);
  }
});