import { supabase } from '@/integrations/supabase/client';

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '');
}

const DEPOSIT_BCC = ['k.trinh@alix-operation.de', 'natalia.p@alix-operation.de'];

/**
 * Sendet eine Auftrags-bezogene Anzahlungs-Bestätigung an den Kunden.
 * BCC: k.trinh@alix-operation.de, natalia.p@alix-operation.de
 * Wird automatisch aufgerufen, sobald eine Anzahlung gebucht/markiert wird.
 */
export async function sendDepositReceivedNotice(
  orderId: string,
  opts: {
    depositAmount?: number | null;
    depositDate?: string | null;
    trigger?: 'automatisch' | 'manuell';
    /** Optionaler Suffix für Idempotenz-Key (z. B. additional-deposit-id) */
    keySuffix?: string;
  } = {},
): Promise<{ ok: boolean; message: string }> {
  try {
    const { data: order, error: oErr } = await supabase
      .from('orders')
      .select('id, order_number, customer_id')
      .eq('id', orderId)
      .maybeSingle();
    if (oErr || !order) return { ok: false, message: oErr?.message || 'Auftrag nicht gefunden' };

    const { data: customer } = await supabase
      .from('customers')
      .select('email, contact_name, company_name')
      .eq('id', order.customer_id)
      .maybeSingle();
    if (!customer?.email) return { ok: false, message: 'Kunde hat keine E-Mail-Adresse' };

    const { data: tpl } = await supabase
      .from('email_templates')
      .select('subject, body, display_name')
      .eq('template_key', 'customer_deposit_received')
      .maybeSingle();
    if (!tpl) return { ok: false, message: "E-Mail Vorlage 'customer_deposit_received' nicht gefunden" };

    const amountStr = typeof opts.depositAmount === 'number' && Number.isFinite(opts.depositAmount)
      ? opts.depositAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
      : '–';
    const dateStr = opts.depositDate
      ? new Date(opts.depositDate).toLocaleDateString('de-DE')
      : new Date().toLocaleDateString('de-DE');

    const vars = {
      customerName: customer.contact_name || customer.company_name || '',
      orderNumber: order.order_number || '',
      depositAmount: amountStr,
      depositDate: dateStr,
    };
    const subject = renderTemplate(tpl.subject, vars);
    const body = renderTemplate(tpl.body, vars);

    const trigger = opts.trigger ?? 'automatisch';
    const suffix = opts.keySuffix ? `-${opts.keySuffix}` : '';
    const key = `customer_deposit_received-${orderId}${suffix}-${trigger}`;

    const { error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'customer-shipping-notice',
        recipientEmail: customer.email,
        idempotencyKey: key,
        templateData: { subject, body },
        bcc: DEPOSIT_BCC,
      },
    });
    if (error) return { ok: false, message: error.message };

    const { data: userData } = await supabase.auth.getUser();
    const triggerLabel = trigger === 'manuell' ? 'Manuell versendet' : 'Automatisch versendet';
    const templateLabel = (tpl as any).display_name || 'Kunde – Anzahlung erhalten';
    const noteText = [
      `[${triggerLabel}] ${templateLabel}`,
      `An: ${customer.email}`,
      `BCC: ${DEPOSIT_BCC.join(', ')}`,
      `Betreff: ${subject}`,
      '',
      body,
    ].join('\n');
    await supabase.from('order_notes').insert({
      order_id: orderId,
      note_type: 'email',
      is_internal: true,
      note_text: noteText,
      created_by: userData.user?.id ?? null,
    });

    return { ok: true, message: `Anzahlungs-Bestätigung an ${customer.email} versendet` };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Unbekannter Fehler' };
  }
}
