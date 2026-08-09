import { supabase } from '@/integrations/supabase/client';
import { buildDeliveryApprovalPdf } from './protokoll-pdf';
import type { DeliveryApproval, ApprovalEvent } from './api';

const db = supabase as any;

export interface ProtokollParams {
  approval: DeliveryApproval;
  events: ApprovalEvent[];
  orderNumber?: string | null;
  customerId?: string | null;
  customerName?: string | null;
}

export function protokollFileName(p: ProtokollParams) {
  return `Freigabeprotokoll_${p.orderNumber ?? p.approval.order_id.slice(0, 8)}.pdf`
    .replace(/[^\w.\-]+/g, '_');
}

function pdfBlob(p: ProtokollParams): Blob {
  return buildDeliveryApprovalPdf(p).output('blob') as Blob;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** Freigabeprotokoll als PDF revisionssicher in AlixDocs zum Auftrag ablegen. */
export async function archiveApprovalPdf(p: ProtokollParams): Promise<string> {
  const name = protokollFileName(p);
  const blob = pdfBlob(p);
  const fd = new FormData();
  fd.append('file', new File([blob], name, { type: 'application/pdf' }));
  fd.append('category_code', 'uebergabe');
  fd.append('title', `Freigabeprotokoll Auslieferung ${p.orderNumber ?? ''}`.trim());
  fd.append('confidentiality_level', 'normal');
  fd.append('order_id', p.approval.order_id);
  if (p.customerId) fd.append('customer_id', p.customerId);
  const { data, error } = await supabase.functions.invoke('alixdocs-upload', { body: fd });
  if (error) throw error;
  const docId = (data as any)?.document_id ?? (data as any)?.id;

  await db.from('delivery_approval_events').insert({
    approval_id: p.approval.id,
    order_id: p.approval.order_id,
    stage: 'archive',
    old_status: p.approval.overall_status,
    new_status: p.approval.overall_status,
    user_name: 'Archivierung',
    comment: `Freigabeprotokoll in AlixDocs archiviert (${name})`,
  });
  return docId;
}

/** Freigabeprotokoll per E-Mail versenden (BCC an Buchhaltung). */
export async function mailApprovalPdf(p: ProtokollParams & { to: string[]; note?: string }): Promise<void> {
  const blob = pdfBlob(p);
  const { data, error } = await supabase.functions.invoke('delivery-approval-mail', {
    body: {
      to: p.to,
      order_number: p.orderNumber ?? null,
      order_id: p.approval.order_id,
      note: p.note ?? null,
      filename: protokollFileName(p),
      pdf_base64: await blobToBase64(blob),
    },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);

  await db.from('delivery_approval_events').insert({
    approval_id: p.approval.id,
    order_id: p.approval.order_id,
    stage: 'mail',
    old_status: p.approval.overall_status,
    new_status: p.approval.overall_status,
    user_name: 'E-Mail-Versand',
    comment: `Freigabeprotokoll versendet an ${p.to.join(', ')}`,
  });
}
