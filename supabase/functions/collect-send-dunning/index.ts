// ALIX COLLECT – Mahnung versenden (E-Mail) + Protokollierung
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const ALLOWED = ['Super Admin', 'Admin', 'Finance', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'];

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
const esc = (s: string) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
const eur = (n: number, cur = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur }).format(Number(n || 0));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: rolesRows } = await admin.from('user_roles').select('roles(name)').eq('user_id', user.id);
    const roleNames = (rolesRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    if (!roleNames.some((n: string) => ALLOWED.includes(n))) return json({ error: 'Keine Berechtigung' }, 403);

    const body = await req.json().catch(() => ({}));
    const { case_id, stage_code, to_email, subject: subjOverride, body_html: htmlOverride, preview } = body as {
      case_id?: string; stage_code?: string; to_email?: string; subject?: string; body_html?: string; preview?: boolean;
    };
    if (!case_id) return json({ error: 'case_id erforderlich' }, 400);

    const { data: c } = await admin.from('collect_cases').select('*').eq('id', case_id).maybeSingle();
    if (!c) return json({ error: 'Fall nicht gefunden' }, 404);

    const code = stage_code ?? c.stage_code ?? 'pre_due';
    const { data: stage } = await admin.from('collect_stage_config').select('*').eq('code', code).maybeSingle();

    const { data: items } = await admin
      .from('collect_case_items')
      .select('invoice_number, invoice_date, due_date, balance, currency, days_overdue')
      .eq('case_id', case_id)
      .order('due_date', { ascending: true });

    const cur = c.currency || 'EUR';
    const rows = (items ?? []).map((i: any) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${esc(i.invoice_number ?? '–')}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${i.invoice_date ?? '–'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${i.due_date ?? '–'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${i.days_overdue ?? 0}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${eur(i.balance, i.currency || cur)}</td>
      </tr>`).join('');

    const totalDue = Number(c.open_amount ?? 0) + Number(c.fee_amount ?? 0) + Number(c.interest_amount ?? 0);
    const subject = subjOverride
      ?? (stage?.email_subject ?? `${stage?.label ?? 'Zahlungserinnerung'} – offene Posten`)
        .replace('{{kunde}}', c.customer_name ?? '');

    const intro = (stage?.email_body ?? 'wir möchten Sie freundlich an die unten aufgeführten offenen Posten erinnern.')
      .replace('{{kunde}}', c.customer_name ?? '');

    const html = htmlOverride ?? `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;color:#111">
        <h2 style="margin:0 0 4px">${esc(stage?.label ?? 'Zahlungserinnerung')}</h2>
        <p>Sehr geehrte Damen und Herren${c.customer_name ? ` (${esc(c.customer_name)})` : ''},</p>
        <p>${esc(intro)}</p>
        <table style="border-collapse:collapse;width:100%;font-size:13px;margin:16px 0">
          <thead>
            <tr style="background:#f5f5f5">
              <th style="padding:8px;text-align:left">Beleg</th>
              <th style="padding:8px;text-align:left">Datum</th>
              <th style="padding:8px;text-align:left">Fällig</th>
              <th style="padding:8px;text-align:right">Verzug (Tage)</th>
              <th style="padding:8px;text-align:right">Offen</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5" style="padding:8px">Keine offenen Positionen</td></tr>'}</tbody>
        </table>
        <table style="font-size:14px">
          <tr><td style="padding:2px 12px 2px 0">Offene Posten</td><td style="text-align:right">${eur(c.open_amount, cur)}</td></tr>
          ${Number(c.fee_amount) > 0 ? `<tr><td style="padding:2px 12px 2px 0">Mahngebühren</td><td style="text-align:right">${eur(c.fee_amount, cur)}</td></tr>` : ''}
          ${Number(c.interest_amount) > 0 ? `<tr><td style="padding:2px 12px 2px 0">Verzugszinsen</td><td style="text-align:right">${eur(c.interest_amount, cur)}</td></tr>` : ''}
          <tr><td style="padding:6px 12px 2px 0"><strong>Gesamtbetrag</strong></td><td style="text-align:right"><strong>${eur(totalDue, cur)}</strong></td></tr>
        </table>
        <p style="margin-top:16px">Bitte begleichen Sie den Betrag zeitnah. Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben als gegenstandslos.</p>
        <p style="margin-top:16px">Mit freundlichen Grüßen<br/>Alix Lasers ® – Buchhaltung</p>
      </div>`;

    if (preview) return json({ ok: true, subject, html });

    const recipient = to_email ?? c.customer_email;
    if (!recipient) return json({ error: 'Keine E-Mail-Adresse hinterlegt' }, 400);

    const bcc = ['service@alix-lasers.com', 'k.trinh@alix-operation.de'];
    if (stage?.cc_management) bcc.push('rde@alix-lasers.com');


    const mailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-invoice-mail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        to_email: recipient, to_name: c.customer_name, subject,
        body_html: html, body_text: subject, bcc, invoice_number: `collect-${code}`,
      }),
    });
    const mailText = await mailRes.text();
    if (!mailRes.ok) {
      console.error('send-invoice-mail error', mailRes.status, mailText);
      return json({ ok: false, error: `Mailversand fehlgeschlagen (${mailRes.status}): ${mailText.slice(0, 300)}` }, 502);
    }
    console.log('send-invoice-mail ok', mailText.slice(0, 200));

    await admin.from('collect_events').insert({
      case_id, event_type: 'email_sent', channel: 'email', direction: 'out', stage_code: code,
      subject, body: html, actor: user.id, actor_email: user.email ?? null, automated: false,
      meta: { to: recipient, bcc },
    });
    await admin.from('collect_cases').update({
      last_contact_at: new Date().toISOString(), stage_code: code, next_action: null, next_action_at: null,
    }).eq('id', case_id);

    return json({ ok: true, sent_to: recipient, subject });
  } catch (e: any) {
    console.error('collect-send-dunning failed:', e?.message ?? e);
    return json({ ok: false, error: e?.message ?? 'internal' }, 500);
  }
});
