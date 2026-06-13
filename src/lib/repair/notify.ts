import { supabase } from '@/integrations/supabase/client';
import { workOrderPdfBase64 } from '@/lib/repair/work-order-pdf';

const REPAIR_NOTIFY_BLOCKLIST = new Set(['homebln@icloud.com']);
const REPAIR_NOTIFY_RECIPIENTS = [
  'jh@alix-operation.de',
  's.galushchak@alix-operation.de',
  'k.trinh@alix-operation.de',
].filter((e) => !REPAIR_NOTIFY_BLOCKLIST.has(e.toLowerCase()));

export async function notifyNewRepairOrder(args: {
  repair_id: string;
  repair_number?: string | null;
  customer_name?: string | null;
  device_model?: string | null;
  device_serial_number?: string | null;
  issue_description?: string | null;
}) {
  const subject = `Neue Reparatur ${args.repair_number ?? ''} angelegt`.trim();
  const link = `https://www.alixwork.de/reparatur/${args.repair_id}`;
  const html = `
    <p>Es wurde ein neuer Reparaturauftrag angelegt.</p>
    <table style="border-collapse:collapse;font-size:14px">
      <tr><td style="padding:4px 8px"><b>Reparaturnummer:</b></td><td style="padding:4px 8px">${args.repair_number ?? '-'}</td></tr>
      <tr><td style="padding:4px 8px"><b>Kunde:</b></td><td style="padding:4px 8px">${args.customer_name ?? '-'}</td></tr>
      <tr><td style="padding:4px 8px"><b>Modell:</b></td><td style="padding:4px 8px">${args.device_model ?? '-'}</td></tr>
      <tr><td style="padding:4px 8px"><b>Seriennummer:</b></td><td style="padding:4px 8px">${args.device_serial_number ?? '-'}</td></tr>
      <tr><td style="padding:4px 8px;vertical-align:top"><b>Fehler:</b></td><td style="padding:4px 8px">${args.issue_description ?? '-'}</td></tr>
    </table>
    <p><a href="${link}">Reparatur öffnen</a></p>
  `;
  const text = `Neue Reparatur ${args.repair_number ?? ''}\nKunde: ${args.customer_name ?? '-'}\nModell: ${args.device_model ?? '-'}\nSeriennummer: ${args.device_serial_number ?? '-'}\nFehler: ${args.issue_description ?? '-'}\n${link}`;

  await Promise.allSettled(
    REPAIR_NOTIFY_RECIPIENTS.map((to) =>
      supabase.functions.invoke('send-mail', {
        body: {
          to_email: to,
          from_email: 'service@alixwork.de',
          subject,
          body_html: html,
          body_text: text,
          repair_id: args.repair_id,
        },
      })
    )
  );
}

/**
 * Bestätigungs-E-Mail an Endkunden inkl. Arbeitsauftrag-PDF (Logo oben rechts).
 * Wird zusätzlich zur internen Mitarbeiter-Benachrichtigung gesendet.
 */
export async function sendRepairConfirmationToCustomer(args: {
  repair: any;
  parts?: any[];
}) {
  const r = args.repair;
  const to = (r.customer_email || '').trim();
  if (!to) return { skipped: true, reason: 'no_customer_email' };

  const device = [r.device_brand, r.device_model].filter(Boolean).join(' ') || r.device_category || '–';
  const subject = `Eingangsbestätigung Reparatur ${r.repair_number || ''}`.trim();

  let attachments: any[] = [];
  try {
    const { base64, fileName } = await workOrderPdfBase64({ repair: r, parts: args.parts || [] });
    attachments = [{ filename: fileName, content: base64, content_type: 'application/pdf' }];
  } catch (e) {
    console.warn('PDF generation for customer mail failed', e);
  }

  const html = `
    <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:640px">
      <p>Sehr geehrte/r ${r.customer_contact || r.customer_name || 'Kund:in'},</p>
      <p>vielen Dank, dass Sie uns Ihr Gerät zur Reparatur anvertrauen.
         Wir haben Ihren Auftrag erfolgreich aufgenommen und bestätigen Ihnen hiermit den Eingang.</p>

      <h3 style="margin:18px 0 6px;color:#8a6d2b">Ihre Auftragsdaten</h3>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:3px 8px;color:#666"><b>Reparaturnummer</b></td><td style="padding:3px 8px">${r.repair_number ?? '-'}</td></tr>
        ${r.order_number ? `<tr><td style="padding:3px 8px;color:#666"><b>Auftrag</b></td><td style="padding:3px 8px">${r.order_number}</td></tr>` : ''}
        <tr><td style="padding:3px 8px;color:#666"><b>Kunde</b></td><td style="padding:3px 8px">${r.customer_name ?? '-'}</td></tr>
        <tr><td style="padding:3px 8px;color:#666"><b>Gerät</b></td><td style="padding:3px 8px">${device}</td></tr>
        <tr><td style="padding:3px 8px;color:#666"><b>Seriennummer</b></td><td style="padding:3px 8px">${r.device_serial_number ?? '-'}</td></tr>
        <tr><td style="padding:3px 8px;color:#666;vertical-align:top"><b>Fehlerbild</b></td><td style="padding:3px 8px">${(r.customer_error_description || r.issue_description || '-').toString().replace(/\n/g, '<br>')}</td></tr>
        ${r.accessories ? `<tr><td style="padding:3px 8px;color:#666"><b>Zubehör</b></td><td style="padding:3px 8px">${r.accessories}</td></tr>` : ''}
      </table>

      <p style="margin-top:18px">Im Anhang finden Sie Ihren <b>Arbeitsauftrag</b> als PDF-Dokument mit allen Details.</p>
      <p>Sie erhalten von uns automatisch eine Information, sobald sich der Status Ihrer Reparatur ändert.</p>

      <p style="margin-top:24px">Mit besten Grüßen<br><b>Ihr Alix Lasers Service-Team</b></p>
    </div>
  `;

  const text = `Sehr geehrte/r ${r.customer_contact || r.customer_name || 'Kund:in'},

vielen Dank für Ihren Reparaturauftrag.

Reparaturnummer: ${r.repair_number ?? '-'}
Kunde: ${r.customer_name ?? '-'}
Gerät: ${device}
Seriennummer: ${r.device_serial_number ?? '-'}
Fehlerbild: ${r.customer_error_description || r.issue_description || '-'}

Den Arbeitsauftrag finden Sie als PDF im Anhang.

Mit besten Grüßen
Ihr Alix Lasers Service-Team`;

  return supabase.functions.invoke('send-mail', {
    body: {
      to_email: to,
      to_name: r.customer_name || undefined,
      from_email: 'service@alixwork.de',
      subject,
      body_html: html,
      body_text: text,
      repair_id: r.repair_id || r.id,
      customer_id: r.customer_id || undefined,
      attachments,
    },
  });
}
