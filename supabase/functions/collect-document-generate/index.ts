import "../_shared/global-bcc.ts";
// ALIX COLLECT – Schriftverkehr-Generator (Mahnschreiben, Anwaltsschreiben, Ratenvereinbarung)
// Erzeugt ein PDF, archiviert es im Storage und versendet es optional per E-Mail.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { renderPdf, eur, de, san, type Block } from '../_shared/collect-pdf.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const BUCKET = 'finance-documents';
const FROM = 'Alix Lasers ® <finance@alixwork.de>';
const BCC = 'k.trinh@alix-operation.de';

const ALLOWED = ['Super Admin', 'Admin', 'Finance', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'];

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const DOC_TYPES: Record<string, { label: string; subject: string }> = {
  mahnschreiben: { label: 'Mahnschreiben', subject: 'Zahlungserinnerung / Mahnung' },
  letzte_mahnung: { label: 'Letzte Mahnung', subject: 'Letzte Mahnung vor Uebergabe' },
  anwaltsschreiben: { label: 'Anwaltsschreiben', subject: 'Ankuendigung anwaltlicher Schritte' },
  ratenvereinbarung: { label: 'Ratenvereinbarung', subject: 'Ratenzahlungsvereinbarung' },
  saldenbestaetigung: { label: 'Saldenbestaetigung', subject: 'Saldenbestaetigung' },
};

function bodyText(docType: string, customer: string, total: string, deadline: string, extra?: string) {
  const head = `Sehr geehrte Damen und Herren,\n\n`;
  const foot = `\n\nMit freundlichen Gruessen\n\nAlix Lasers (R)\nForderungsmanagement`;
  const note = extra ? `\n\n${extra}` : '';

  switch (docType) {
    case 'letzte_mahnung':
      return head
        + `trotz mehrfacher Erinnerung ist der nachfolgend aufgefuehrte Betrag in Hoehe von ${total} weiterhin offen.\n\n`
        + `Wir fordern Sie hiermit letztmalig auf, den Betrag bis zum ${deadline} auszugleichen. `
        + `Nach fruchtlosem Ablauf dieser Frist geben wir den Vorgang ohne weitere Ankuendigung an unseren Rechtsanwalt bzw. ein Inkassounternehmen ab. `
        + `Die dadurch entstehenden Kosten haben Sie zu tragen.` + note + foot;
    case 'anwaltsschreiben':
      return head
        + `der nachstehend aufgefuehrte Betrag in Hoehe von ${total} ist trotz Mahnung nicht ausgeglichen worden.\n\n`
        + `Der Vorgang wird zur weiteren rechtlichen Verfolgung vorbereitet. Sie haben letztmalig Gelegenheit, `
        + `den Betrag bis zum ${deadline} auf unser Konto zu ueberweisen und damit ein gerichtliches Mahnverfahren zu vermeiden. `
        + `Wir weisen darauf hin, dass im Falle der gerichtlichen Geltendmachung erhebliche Zusatzkosten entstehen.` + note + foot;
    case 'ratenvereinbarung':
      return head
        + `auf Grundlage Ihrer Anfrage bestaetigen wir die nachstehende Ratenzahlungsvereinbarung ueber einen Gesamtbetrag von ${total}.\n\n`
        + `Die Vereinbarung wird wirksam mit Eingang der ersten Rate. Bei Ausbleiben einer Rate entfaellt die Stundung und `
        + `der gesamte Restbetrag wird sofort zur Zahlung faellig.` + note + foot;
    case 'saldenbestaetigung':
      return head
        + `zur Abstimmung unserer Buchhaltung bestaetigen wir zum heutigen Tage einen offenen Saldo von ${total}.\n\n`
        + `Bitte pruefen Sie die nachstehende Aufstellung und bestaetigen Sie uns den Saldo bis zum ${deadline}.` + note + foot;
    default:
      return head
        + `bei der Durchsicht unserer Unterlagen mussten wir feststellen, dass der nachstehend aufgefuehrte Betrag `
        + `in Hoehe von ${total} noch offen ist.\n\n`
        + `Wir bitten Sie, den Betrag bis zum ${deadline} auf unser Konto zu ueberweisen. `
        + `Sollte sich Ihre Zahlung mit diesem Schreiben ueberschnitten haben, betrachten Sie es bitte als gegenstandslos.` + note + foot;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { data: rolesRows } = await admin.from('user_roles').select('roles(name)').eq('user_id', user.id);
    const roleNames = (rolesRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    if (!roleNames.some((n: string) => ALLOWED.includes(n))) return json({ error: 'Keine Berechtigung' }, 403);

    const body = await req.json().catch(() => ({}));
    const caseId: string = body?.case_id ?? '';
    const docType: string = DOC_TYPES[body?.doc_type] ? body.doc_type : 'mahnschreiben';
    const deadlineDays = Math.min(Math.max(Number(body?.deadline_days ?? 10), 1), 90);
    const extra: string = String(body?.note ?? '').slice(0, 800);
    const send = !!body?.send;
    const toEmail: string | null = body?.to_email ?? null;

    if (!caseId) return json({ error: 'case_id erforderlich' }, 400);

    const { data: c } = await admin.from('collect_cases').select('*').eq('id', caseId).maybeSingle();
    if (!c) return json({ error: 'Fall nicht gefunden' }, 404);

    const { data: items } = await admin
      .from('collect_case_items')
      .select('invoice_number, invoice_date, due_date, balance, currency, days_overdue')
      .eq('case_id', caseId)
      .gt('balance', 0)
      .order('due_date');

    const cur = c.currency || 'EUR';
    const total = (items ?? []).reduce((a: number, i: any) => a + Number(i.balance ?? 0), 0)
      + Number(c.interest_amount ?? 0) + Number(c.fee_amount ?? 0);
    const deadline = new Date(Date.now() + deadlineDays * 86400000);
    const deadlineStr = deadline.toLocaleDateString('de-DE');
    const meta = DOC_TYPES[docType];

    const blocks: Block[] = [
      { type: 'p', text: `${c.customer_name ?? ''}\n\n${new Date().toLocaleDateString('de-DE')}` },
      { type: 'h1', text: meta.subject },
    ];

    let planTotal: number | null = null;

    if (docType === 'ratenvereinbarung') {
      // Ratenplan laden (explizit oder der zuletzt angelegte des Falls)
      let planQuery = admin.from('collect_payment_plans').select('*').eq('case_id', caseId);
      if (body?.plan_id) planQuery = planQuery.eq('id', body.plan_id);
      const { data: plans } = await planQuery.order('created_at', { ascending: false }).limit(1);
      const plan: any = (plans ?? [])[0] ?? null;

      if (plan) {
        planTotal = Number(plan.total_amount ?? total);
        const { data: rates } = await admin
          .from('collect_payment_plan_items')
          .select('seq, due_date, amount, status')
          .eq('plan_id', plan.id)
          .order('seq');

        blocks.push({ type: 'p', text: bodyText(docType, c.customer_name ?? '', eur(planTotal, cur), deadlineStr, extra) });
        blocks.push({ type: 'h2', text: 'Konditionen' });
        blocks.push({
          type: 'table',
          head: ['Position', 'Wert'],
          widths: [200, 295],
          rows: [
            ['Gesamtforderung', eur(plan.total_amount, cur)],
            ['Anzahlung', eur(plan.downpayment, cur)],
            ['Monatliche Rate', eur(plan.monthly_amount, cur)],
            ['Laufzeit', `${plan.term_months ?? 0} Monate`],
            ['Beginn', de(plan.start_date)],
            ['SEPA-Lastschrift', plan.sepa_iban_masked ?? 'nein'],
          ],
        });
        blocks.push({ type: 'h2', text: 'Ratenplan' });
        blocks.push({
          type: 'table',
          head: ['Rate', 'Faellig am', 'Betrag', 'Status'],
          widths: [70, 150, 150, 125],
          rows: (rates ?? []).map((r: any) => [
            String(r.seq), de(r.due_date), eur(r.amount, cur), san(r.status ?? 'offen'),
          ]),
        });
        blocks.push({ type: 'spacer', size: 24 });

        if (plan.signed_at && plan.signature_data_url) {
          blocks.push({ type: 'h2', text: 'Digitale Unterschrift des Kunden' });
          blocks.push({
            type: 'image',
            dataUrl: String(plan.signature_data_url),
            width: 180,
            caption: `${san(plan.signed_name ?? '')} | ${new Date(plan.signed_at).toLocaleString('de-DE')}${plan.signed_ip ? ` | IP ${san(plan.signed_ip)}` : ''}`,
          });
          blocks.push({ type: 'p', text: 'Elektronisch unterzeichnet ueber das Alix Zahlungsportal. Name, Zeitstempel und IP-Adresse sind revisionssicher gespeichert.' });
          blocks.push({ type: 'spacer', size: 12 });
          blocks.push({
            type: 'table',
            head: ['Alix Lasers (R)'],
            widths: [495],
            rows: [['____________________________']],
          });
        } else {
          blocks.push({
            type: 'table',
            head: ['Ort, Datum / Kunde', 'Alix Lasers (R)'],
            widths: [250, 245],
            rows: [['____________________________', '____________________________']],
          });
        }
      } else {
        blocks.push({ type: 'p', text: bodyText(docType, c.customer_name ?? '', eur(total, cur), deadlineStr, extra) });
        blocks.push({ type: 'p', text: 'Hinweis: Zu diesem Fall ist noch kein Ratenplan hinterlegt.' });
      }
    } else {
      blocks.push({ type: 'p', text: bodyText(docType, c.customer_name ?? '', eur(total, cur), deadlineStr, extra) });
      blocks.push({ type: 'h2', text: 'Offene Posten' });
      blocks.push({
        type: 'table',
        head: ['Rechnung', 'Datum', 'Faellig', 'Verzug', 'Betrag'],
        widths: [110, 80, 80, 60, 165],
        rows: [
          ...(items ?? []).map((i: any) => [
            i.invoice_number ?? '-', de(i.invoice_date), de(i.due_date),
            `${i.days_overdue ?? 0} T`, eur(i.balance, i.currency ?? cur),
          ]),
          ...(Number(c.interest_amount ?? 0) > 0 ? [['Verzugszinsen', '', '', '', eur(c.interest_amount, cur)]] : []),
          ...(Number(c.fee_amount ?? 0) > 0 ? [['Mahngebuehren', '', '', '', eur(c.fee_amount, cur)]] : []),
          ['GESAMT', '', '', '', eur(total, cur)],
        ],
      });
    }


    const bytes = await renderPdf({
      title: meta.label,
      subtitle: `${c.customer_name ?? ''} | Zahlungsziel ${deadlineStr}`,
      blocks,
    });

    const { data: docRow, error: insErr } = await admin.from('collect_documents').insert({
      case_id: caseId,
      customer_id: c.customer_id,
      customer_name: c.customer_name,
      doc_type: docType,
      title: `${meta.label} ${c.customer_name ?? ''}`.trim(),
      amount: planTotal ?? total,
      currency: cur,
      content: { deadline: deadline.toISOString().slice(0, 10), note: extra, items: items ?? [] },
      created_by: user.id,
    }).select('id').single();
    if (insErr) throw new Error(insErr.message);

    const path = `collect/letters/${docRow.id}.pdf`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: 'application/pdf', upsert: true,
    });
    if (upErr) throw new Error(upErr.message);
    await admin.from('collect_documents').update({ file_path: path }).eq('id', docRow.id);

    let sent = false;
    const recipient = toEmail || c.customer_email;
    if (send && recipient && RESEND_API_KEY) {
      const b64 = btoa(String.fromCharCode(...bytes));
      const res = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY') ?? ''}`,
          'X-Connection-Api-Key': RESEND_API_KEY,
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          from: FROM,
          to: [recipient],
          bcc: [BCC],
          subject: `${meta.subject} - ${c.customer_name ?? ''}`,
          html: `<p>Sehr geehrte Damen und Herren,</p><p>anbei erhalten Sie unser Schreiben als PDF.</p>
                 <p>Offener Betrag: <b>${eur(planTotal ?? total, cur)}</b><br/>Zahlungsziel: <b>${deadlineStr}</b></p>
                 <p>Mit freundlichen Grüßen<br/>Alix Lasers ®<br/>Forderungsmanagement</p>`,
          attachments: [{ filename: `${meta.label.toLowerCase().replace(/\s+/g, '-')}.pdf`, content: b64 }],
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('resend error', res.status, err);
        return json({ error: `E-Mail-Versand fehlgeschlagen: ${err}`, document_id: docRow.id, path }, res.status);
      }
      sent = true;
      await admin.from('collect_documents').update({
        sent_at: new Date().toISOString(), sent_to: recipient, channel: 'email',
      }).eq('id', docRow.id);
      await admin.from('collect_events').insert({
        case_id: caseId,
        event_type: 'document_sent',
        channel: 'email',
        direction: 'outbound',
        subject: `${meta.label} versendet an ${recipient}`,
        actor: user.id,
        meta: { document_id: docRow.id, doc_type: docType, amount: total },
      });
    } else {
      await admin.from('collect_events').insert({
        case_id: caseId,
        event_type: 'document_created',
        subject: `${meta.label} erstellt`,
        actor: user.id,
        meta: { document_id: docRow.id, doc_type: docType, amount: total },
      });
    }

    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    return json({ success: true, document_id: docRow.id, path, url: signed?.signedUrl ?? null, sent, total: san(eur(total, cur)) });
  } catch (e: any) {
    console.error('collect-document-generate error', e);
    return json({ error: e?.message ?? 'Unbekannter Fehler' }, 500);
  }
});