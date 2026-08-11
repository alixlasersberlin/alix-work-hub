import "../_shared/global-bcc.ts";
// Cron: versendet automatische Umfrage-Erinnerungen an noch nicht abgeschlossene Einladungen.
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

const ORIGIN = 'https://alixwork.de';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: surveys } = await admin.from('surveys')
      .select('id, name, public_title, status, auto_reminder_enabled, auto_reminder_days, auto_reminder_max, ends_at')
      .eq('status', 'aktiv').eq('auto_reminder_enabled', true);

    let sent = 0, skipped = 0;

    for (const s of surveys ?? []) {
      if (s.ends_at && new Date(s.ends_at) < now) continue;
      const days = Math.max(1, s.auto_reminder_days ?? 5);
      const maxCount = Math.max(1, s.auto_reminder_max ?? 2);
      const cutoff = new Date(now.getTime() - days * 864e5).toISOString();

      const { data: tpl } = await admin.from('survey_email_templates')
        .select('subject, body_html, reply_to')
        .eq('kind', 'erinnerung').or(`survey_id.eq.${s.id},survey_id.is.null`)
        .order('survey_id', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();

      const { data: invites } = await admin.from('survey_invitations')
        .select('id, token, recipient_id, sent_at, last_reminder_at, reminder_count')
        .eq('survey_id', s.id).is('completed_at', null).not('sent_at', 'is', null)
        .lt('reminder_count', maxCount).limit(200);

      for (const inv of invites ?? []) {
        const ref = inv.last_reminder_at ?? inv.sent_at;
        if (!ref || ref > cutoff) { skipped++; continue; }

        const { data: r } = await admin.from('survey_recipients')
          .select('id, email, first_name, last_name, company_name, unsubscribed_at')
          .eq('id', inv.recipient_id).maybeSingle();
        if (!r?.email || r.unsubscribed_at || r.email.endsWith('@umfrage.local')) { skipped++; continue; }

        const link = `${ORIGIN}/umfrage/${inv.token}`;
        const ctx = {
          name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.company_name || 'Kunde',
          firma: r.company_name ?? '',
          link,
          umfrage: s.public_title || s.name,
        };
        const subject = tpl?.subject ? render(tpl.subject, ctx) : `Erinnerung: ${ctx.umfrage}`;
        const html = tpl?.body_html
          ? render(tpl.body_html, ctx)
          : `<p>Guten Tag ${ctx.name},</p><p>gerne erinnern wir Sie an unsere kurze Umfrage.</p>
             <p><a href="${link}">Umfrage jetzt starten</a></p><p>Vielen Dank.<br/>Ihr ALIX Team</p>`;

        const { data: log } = await admin.from('survey_email_logs').insert({
          survey_id: s.id, recipient_id: r.id, invitation_id: inv.id, kind: 'erinnerung',
          to_email: r.email, subject, status: 'queued', scheduled_at: nowIso,
        }).select('id').single();

        try {
          if (!resendKey || !lovableKey) throw new Error('Mail-Konfiguration fehlt');
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
              to: [r.email], subject, html,
            }),
          });
          if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
        } catch (e) {
          await admin.from('survey_email_logs').update({ status: 'failed', error_text: (e as Error).message }).eq('id', log?.id);
          skipped++;
          continue;
        }

        await admin.from('survey_email_logs').update({ status: 'sent', sent_at: nowIso }).eq('id', log?.id);
        await admin.from('survey_invitations').update({
          last_reminder_at: nowIso, reminder_count: (inv.reminder_count ?? 0) + 1,
        }).eq('id', inv.id);
        sent++;
      }
    }

    return json({ ok: true, sent, skipped });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? 'error' }, 500);
  }
});