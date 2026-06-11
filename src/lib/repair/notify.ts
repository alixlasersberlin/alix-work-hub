import { supabase } from '@/integrations/supabase/client';

const REPAIR_NOTIFY_RECIPIENTS = [
  'jh@alix-operation.de',
  's.galushchak@alix-operation.de',
  'k.trinh@alix-operation.de',
];

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
