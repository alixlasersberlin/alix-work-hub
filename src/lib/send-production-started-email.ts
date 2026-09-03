import { supabase } from '@/integrations/supabase/client';

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '');
}

/**
 * Sendet die Vorlage "Kunde – Produktion gestartet" (template_key:
 * 'production_started') an den Kunden, sobald der Produktionsauftrag an den
 * Lieferanten gesendet wurde (Status "gesendet").
 */
export async function sendProductionStartedEmail(
  productionOrderId: string,
  trigger: 'automatisch' | 'manuell' = 'automatisch',
): Promise<{ ok: boolean; message: string }> {
  try {
    const { data: po, error: poErr } = await supabase
      .from('production_orders')
      .select('id, order_id, order_number, modellname, seriennummer, liefertermin')
      .eq('id', productionOrderId)
      .maybeSingle();
    if (poErr || !po) return { ok: false, message: poErr?.message || 'Produktionsauftrag nicht gefunden' };

    let customer: { email: string | null; contact_name: string | null; company_name: string | null } | null = null;
    let orderNumber = po.order_number || '';

    if (po.order_id) {
      const { data: order } = await supabase
        .from('orders')
        .select('order_number, customer_id, customers(email, contact_name, company_name)')
        .eq('id', po.order_id)
        .maybeSingle();
      if (order) {
        orderNumber = order.order_number || orderNumber;
        customer = (order as any).customers || null;
      }
    }

    if (!customer?.email) return { ok: false, message: 'Kunde hat keine E-Mail-Adresse' };

    const { data: tpl } = await supabase
      .from('email_templates')
      .select('subject, body, display_name')
      .eq('template_key', 'production_started')
      .maybeSingle();
    if (!tpl) return { ok: false, message: "E-Mail Vorlage 'production_started' nicht gefunden" };

    const deviceInfo = [po.modellname, po.seriennummer ? `(SN: ${po.seriennummer})` : null]
      .filter(Boolean).join(' ') || '–';
    const deliveryDate = po.liefertermin
      ? new Date(po.liefertermin).toLocaleDateString('de-DE')
      : 'wird noch abgestimmt';

    const vars = {
      customerName: customer.contact_name || customer.company_name || '',
      orderNumber,
      deviceInfo,
      deliveryDate,
    };
    const subject = renderTemplate(tpl.subject, vars);
    const body = renderTemplate(tpl.body, vars);

    const key = `production-started-${productionOrderId}`;
    const { error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'customer-shipping-notice',
        recipientEmail: customer.email,
        idempotencyKey: key,
        templateData: { subject, body },
      },
    });
    if (error) return { ok: false, message: error.message };

    if (po.order_id) {
      const { data: userData } = await supabase.auth.getUser();
      const triggerLabel = trigger === 'manuell' ? 'Manuell versendet' : 'Automatisch versendet';
      const templateLabel = (tpl as any).display_name || 'Kunde – Produktion gestartet';
      const noteText = [
        `[${triggerLabel}] ${templateLabel}`,
        `An: ${customer.email}`,
        `Betreff: ${subject}`,
        '',
        body,
      ].join('\n');
      await supabase.from('order_notes').insert({
        order_id: po.order_id,
        note_type: 'email',
        is_internal: true,
        note_text: noteText,
        created_by: userData.user?.id ?? null,
      });
    }

    return { ok: true, message: `E-Mail an ${customer.email} versendet` };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Unbekannter Fehler' };
  }
}
