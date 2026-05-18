import { supabase } from '@/integrations/supabase/client';
import { generateProductionOrderPdf } from '@/lib/production-order-pdf';

const BCC_EMAIL = 'rde@alix-lasers.com';
const TEN_YEARS_SECONDS = 60 * 60 * 24 * 365 * 10;

export interface SendResult {
  ok: boolean;
  total: number;
  sent: number;
  message: string;
}

/**
 * Generiert (falls nötig) das PDF für eine Produktionsbestellung, lädt es hoch,
 * erstellt einen dauerhaften Link und versendet die E-Mail an den Zulieferer
 * (inkl. zweiter Adresse) sowie als Kopie an rde@alix-lasers.com.
 */
export async function sendProductionOrderEmail(poId: string): Promise<SendResult> {
  // 1) Bestellung + Items laden
  const { data: po, error: poErr } = await supabase
    .from('production_orders')
    .select('*, supplier:suppliers(*)')
    .eq('id', poId)
    .single();
  if (poErr || !po) return { ok: false, total: 0, sent: 0, message: poErr?.message || 'Bestellung nicht gefunden' };

  if (po.approval_status !== 'approved') {
    return { ok: false, total: 0, sent: 0, message: 'Bestellung muss erst von einem Super Admin genehmigt werden.' };
  }

  const supplier = po.supplier;
  if (!supplier) return { ok: false, total: 0, sent: 0, message: 'Kein Zulieferer hinterlegt' };

  const recipients = [supplier.email, (supplier as any).email_secondary]
    .map((e: string | null | undefined) => (e || '').trim())
    .filter(Boolean);
  if (recipients.length === 0) {
    return { ok: false, total: 0, sent: 0, message: 'Zulieferer hat keine E-Mail-Adresse hinterlegt' };
  }

  const { data: items } = await supabase
    .from('production_order_items')
    .select('*')
    .eq('production_order_id', poId)
    .order('item_order');

  // 2) PDF generieren + hochladen
  const displayOrderNumber = po.production_order_number || po.order_number;
  const pdf = await generateProductionOrderPdf({
    order_number: displayOrderNumber,
    modellname: po.modellname,
    farbe: po.farbe,
    power_handstueck: po.power_handstueck,
    bearbeiter: po.bearbeiter,
    liefertermin: po.liefertermin,
    sonderwuensche: po.sonderwuensche,
    seriennummer: po.seriennummer,
    anmerkungen: po.anmerkungen,
    supplier,
    items: items || [],
  }, 'bilingual');

  const path = `${poId}/${pdf.filename}`;
  const up = await supabase.storage
    .from('production-orders')
    .upload(path, pdf.blob, { upsert: true, contentType: 'application/pdf' });
  if (up.error) return { ok: false, total: 0, sent: 0, message: up.error.message };

  const { data: signed, error: sigErr } = await supabase.storage
    .from('production-orders')
    .createSignedUrl(path, TEN_YEARS_SECONDS);
  if (sigErr || !signed) return { ok: false, total: 0, sent: 0, message: sigErr?.message || 'Link-Erstellung fehlgeschlagen' };

  await supabase.from('production_orders').update({
    pdf_path: path,
    sent_at: new Date().toISOString(),
    status: 'gesendet',
  }).eq('id', poId);

  // 3) E-Mail an alle Empfänger (inkl. BCC)
  const templateData = {
    order_number: displayOrderNumber,
    supplier_name: supplier.name,
    modellname: po.modellname,
    farbe: po.farbe,
    power_handstueck: po.power_handstueck,
    liefertermin: po.liefertermin,
    bearbeiter: po.bearbeiter,
    anmerkungen: po.anmerkungen,
    pdf_url: signed.signedUrl,
    is_reclamation: !!po.is_reclamation,
  };

  const allRecipients = Array.from(new Set([...recipients, BCC_EMAIL]));
  const results = await Promise.allSettled(
    allRecipients.map(email =>
      supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'production-order-supplier',
          recipientEmail: email,
          idempotencyKey: `po-send-${poId}-${email}-${Date.now()}`,
          templateData,
        },
      })
    )
  );
  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as any)?.error));
  const sent = allRecipients.length - failed.length;
  if (sent === 0) return { ok: false, total: allRecipients.length, sent: 0, message: 'E-Mail-Versand fehlgeschlagen' };
  if (failed.length > 0) {
    return { ok: true, total: allRecipients.length, sent, message: `E-Mail teilweise versendet (${sent}/${allRecipients.length})` };
  }
  return { ok: true, total: allRecipients.length, sent, message: `E-Mail an Zulieferer versendet (Kopie an ${BCC_EMAIL})` };
}
