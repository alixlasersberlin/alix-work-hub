import { supabase } from '@/integrations/supabase/client';

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '');
}

export type ShippingNoticeTrigger = 'automatisch' | 'manuell';

/**
 * Sendet eine Auftrags-bezogene E-Mail an den Kunden anhand einer Vorlage
 * aus public.email_templates. Standard-Vorlage: 'customer_warehouse_received'
 * (Lagereingang) wird automatisch bei Zubuchung versendet.
 * 'customer_shipping_notice' (Teillieferung) wird nur manuell versendet.
 *
 * Erfolgreich versendete E-Mails werden als Notiz (note_type='email')
 * am Auftrag protokolliert (Tab "E-Mails").
 */
export async function sendCustomerShippingNotice(
  orderId: string,
  deviceId?: string,
  trigger: ShippingNoticeTrigger = 'automatisch',
  templateKey: 'customer_warehouse_received' | 'customer_shipping_notice' | 'customer_in_transit' | 'customer_in_production' | 'customer_warehouse_prepared' | 'customer_delivered' = 'customer_warehouse_received',
  prefetchedDevices?: Array<{ model_name: string | null; serial_number: string | null }>,
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
      .eq('template_key', templateKey)
      .maybeSingle();
    if (!tpl) return { ok: false, message: `E-Mail Vorlage '${templateKey}' nicht gefunden` };

    // Geräte-Infos: vom Aufrufer übergeben, konkretes Gerät, oder reservierte Geräte des Auftrags.
    let devices: Array<{ model_name: string | null; serial_number: string | null }> = [];
    if (prefetchedDevices && prefetchedDevices.length > 0) {
      devices = prefetchedDevices;
    } else if (deviceId) {
      const { data: dev } = await supabase
        .from('lager_devices')
        .select('model_name, serial_number')
        .eq('id', deviceId)
        .maybeSingle();
      if (dev) devices = [dev];
    }
    if (devices.length === 0) {
      const { data: devs } = await supabase
        .from('lager_devices')
        .select('model_name, serial_number')
        .eq('reserved_order_id', orderId);
      devices = devs || [];
    }
    // Fallback (z. B. nach Statuswechsel auf "geliefert", da Reservierungen per
    // DB-Trigger gelöscht wurden): Geräte-Infos aus order_items rekonstruieren.
    if (devices.length === 0) {
      const { data: items } = await supabase
        .from('order_items')
        .select('item_name, sku')
        .eq('order_id', orderId)
        .order('item_order', { ascending: true });
      devices = (items || []).map((it: any) => ({
        model_name: it.item_name || null,
        serial_number: it.sku || null,
      }));
    }
    const deviceInfo = devices.length > 0
      ? devices
          .map((d) => `- ${d.model_name || 'Gerät'}${d.serial_number ? ` (SN: ${d.serial_number})` : ''}`)
          .join('\n')
      : '–';

    const vars = {
      customerName: customer.contact_name || customer.company_name || '',
      orderNumber: order.order_number || '',
      deviceInfo,
    };
    const subject = renderTemplate(tpl.subject, vars);
    const body = renderTemplate(tpl.body, vars);

    const key = `${templateKey}-${orderId}-${deviceId ?? 'na'}-${trigger}-${Date.now()}`;
    const extraCc: string[] = templateKey === 'customer_warehouse_received'
      ? ['jh@alix-operation.de']
      : [];
    const { error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'customer-shipping-notice',
        recipientEmail: customer.email,
        idempotencyKey: key,
        templateData: { subject, body },
        extraCc,
      },
    });
    if (error) return { ok: false, message: error.message };

    // Protokoll im Auftrag (Tab "E-Mails")
    const { data: userData } = await supabase.auth.getUser();
    const triggerLabel = trigger === 'manuell' ? 'Manuell versendet' : 'Automatisch versendet';
    const templateLabel = (tpl as any).display_name || templateKey;
    const noteText = [
      `[${triggerLabel}] ${templateLabel}`,
      `An: ${customer.email}`,
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

    return { ok: true, message: `E-Mail an ${customer.email} versendet` };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Unbekannter Fehler' };
  }
}
