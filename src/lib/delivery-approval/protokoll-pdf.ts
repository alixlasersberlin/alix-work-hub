import jsPDF from 'jspdf';
import { STAGES, STATUS_UI, OVERALL_UI } from './config';
import type { DeliveryApproval, ApprovalEvent } from './api';

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/**
 * Revisionssicheres Freigabeprotokoll (ISO 13485 / MDR):
 * Gesamtstatus, alle drei Stufen mit Prüfpunkten, Unterschriften und vollständiger Audit-Trail.
 */
export function buildDeliveryApprovalPdf(params: {
  approval: DeliveryApproval;
  events: ApprovalEvent[];
  orderNumber?: string | null;
  customerName?: string | null;
}) {
  const { approval, events } = params;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 18;
  const W = 210 - M * 2;
  let y = 20;

  const page = (need = 20) => {
    if (y + need > 282) { doc.addPage(); y = 20; }
  };

  doc.setFontSize(18);
  doc.text('Freigabeprotokoll Auslieferung', M, y);
  y += 7;
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    `Auftrag ${params.orderNumber ?? approval.order_id.slice(0, 8)}${params.customerName ? ` · ${params.customerName}` : ''}`,
    M, y,
  );
  y += 4.5;
  doc.text(`Erstellt am ${fmt(new Date().toISOString())} · Dokument-ID ${approval.id}`, M, y);
  y += 8;
  doc.setTextColor(0);

  doc.setDrawColor(200);
  doc.line(M, y, M + W, y);
  y += 8;

  doc.setFontSize(12);
  doc.text(`Gesamtstatus: ${OVERALL_UI[approval.overall_status]?.label ?? approval.overall_status}`, M, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Freigegeben am: ${fmt(approval.released_at)}`, M, y);
  y += 4.5;
  if (approval.unlock_reason) {
    doc.text(`Super-Admin-Entsperrung: ${approval.unlock_reason} (${fmt(approval.unlocked_at)})`, M, y);
    y += 4.5;
  }
  doc.setTextColor(0);
  y += 5;

  for (const def of STAGES) {
    page(50);
    const status = (approval as any)[`${def.stage}_status`] ?? 'open';
    const checks = ((approval as any)[`${def.stage}_checks`] ?? {}) as Record<string, boolean>;

    doc.setFillColor(245, 245, 245);
    doc.rect(M, y - 5, W, 8, 'F');
    doc.setFontSize(11);
    doc.text(`${def.order}. ${def.title}  —  ${STATUS_UI[status as keyof typeof STATUS_UI]?.label ?? status}`, M + 2, y);
    y += 8;

    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Zuständig: ${def.responsible}`, M + 2, y);
    y += 4.5;
    doc.text(
      `Genehmigt von: ${(approval as any)[`${def.stage}_by_name`] ?? '—'} · ${fmt((approval as any)[`${def.stage}_at`])}`,
      M + 2, y,
    );
    y += 4.5;
    const comment = (approval as any)[`${def.stage}_comment`];
    if (comment) {
      for (const line of doc.splitTextToSize(`Kommentar: ${comment}`, W - 4) as string[]) {
        page(8); doc.text(line, M + 2, y); y += 4.2;
      }
    }
    doc.setTextColor(0);
    y += 2;

    for (const c of def.checks) {
      page(8);
      doc.text(`${checks[c.key] ? '[x]' : '[ ]'}  ${c.label}${c.required ? ' *' : ''}`, M + 3, y);
      y += 4.4;
    }

    const sig = (approval as any)[`${def.stage}_signature`];
    if (sig && typeof sig === 'string' && sig.startsWith('data:image')) {
      page(28);
      try {
        doc.addImage(sig, 'PNG', M + 3, y, 45, 18);
        doc.setDrawColor(180);
        doc.line(M + 3, y + 19, M + 60, y + 19);
        doc.setFontSize(7.5);
        doc.setTextColor(110);
        doc.text('Digitale Unterschrift', M + 3, y + 22.5);
        doc.setTextColor(0);
        doc.setFontSize(9);
        y += 27;
      } catch { y += 2; }
    }
    y += 5;
  }

  page(30);
  doc.setFontSize(12);
  doc.text('Audit-Trail (revisionssicher)', M, y);
  y += 6;
  doc.setFontSize(8);
  for (const e of [...events].reverse()) {
    page(10);
    doc.text(
      `${fmt(e.created_at)} · ${e.stage} · ${e.old_status ?? '—'} → ${e.new_status ?? '—'}`,
      M, y,
    );
    y += 3.8;
    doc.setTextColor(110);
    const meta = `${e.user_name ?? 'Unbekannt'}${e.ip_address ? ` · IP ${e.ip_address}` : ''}${e.comment ? ` · ${e.comment}` : ''}`;
    for (const line of doc.splitTextToSize(meta, W) as string[]) {
      page(8); doc.text(line, M, y); y += 3.6;
    }
    doc.setTextColor(0);
    y += 2;
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(140);
    doc.text(
      `Alix Lasers ® · Freigabeprotokoll Auslieferung · Seite ${i}/${total} · maschinell erzeugt, revisionssicher archiviert`,
      M, 290,
    );
  }

  return doc;
}

export function downloadDeliveryApprovalPdf(params: Parameters<typeof buildDeliveryApprovalPdf>[0]) {
  const doc = buildDeliveryApprovalPdf(params);
  const name = `Freigabeprotokoll_${params.orderNumber ?? params.approval.order_id.slice(0, 8)}.pdf`;
  doc.save(name.replace(/[^\w.\-]+/g, '_'));
}
