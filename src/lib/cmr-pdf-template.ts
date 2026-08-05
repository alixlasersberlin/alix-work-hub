import { supabase } from '@/integrations/supabase/client';
import QRCode from 'qrcode';
import { cmrFetchImage, type CmrPdfOptions, type CmrPdfTemplate } from './cmr-document-pdf';

/**
 * Lädt die PDF-Vorlage einer Belegart (Mandant CMR) inkl. Logo, Wasserzeichen und QR-Code
 * und liefert die fertigen Optionen für `generateCmrDocumentPdf`.
 */
export async function loadCmrPdfOptions(
  tenantId: string | null,
  docType: string,
  qrPayload?: string | null,
  language?: string | null,
): Promise<CmrPdfOptions> {
  if (!tenantId) return {};

  const { data } = await supabase
    .from('cmr_pdf_templates' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('doc_type', docType)
    .order('is_default', { ascending: false })
    .limit(20);

  const all = ((data as any) || []) as (CmrPdfTemplate & { language?: string | null })[];
  // Sprachvorlage bevorzugen, sonst Standardvorlage
  const tpl = (language ? all.find((t) => (t.language ?? 'de') === language) : null)
    ?? all[0]
    ?? null;
  if (!tpl) return {};

  const [logoDataUrl, watermarkDataUrl] = await Promise.all([
    cmrFetchImage(tpl.logo_url),
    cmrFetchImage(tpl.watermark_url),
  ]);

  let qrDataUrl: string | null = null;
  if (tpl.show_qr && qrPayload) {
    try {
      qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 0, width: 240 });
    } catch {
      qrDataUrl = null;
    }
  }

  return { tpl, logoDataUrl, watermarkDataUrl, qrDataUrl };
}
