// PDF-Export für Umfrage-Antworten (Übersicht + Einzelantworten).
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type PdfResponse = {
  id: string;
  completed_at?: string | null;
  created_at?: string | null;
  status?: string | null;
  score_total?: number | null;
  nps_score?: number | null;
  duration_seconds?: number | null;
  is_critical?: boolean | null;
  recipient?: {
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    customer_number?: string | null;
  } | null;
};

export type PdfItem = { response_id: string; question_label?: string | null; value: string };

export function recipientName(r: PdfResponse) {
  return (
    r.recipient?.company_name ||
    `${r.recipient?.first_name ?? ''} ${r.recipient?.last_name ?? ''}`.trim() ||
    'Anonym'
  );
}

function fmtDate(v?: string | null) {
  return v ? new Date(v).toLocaleDateString('de-DE') : '–';
}

/** Erzeugt ein PDF mit Übersichtstabelle und optional allen Einzelantworten. */
export function buildResponsesPdf(opts: {
  surveyName: string;
  responses: PdfResponse[];
  items?: PdfItem[];
  includeDetails?: boolean;
}) {
  const { surveyName, responses, items = [], includeDetails = true } = opts;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(16);
  doc.text('Umfrage-Antworten', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${surveyName} · ${responses.length} Antworten · Stand ${new Date().toLocaleString('de-DE')}`, 14, 25);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 32,
    head: [['Datum', 'Kunde', 'E-Mail', 'Status', 'Score', 'NPS']],
    body: responses.map((r) => [
      fmtDate(r.completed_at ?? r.created_at),
      recipientName(r) + (r.is_critical ? ' (kritisch)' : ''),
      r.recipient?.email ?? '',
      r.status ?? '',
      r.score_total ?? '–',
      r.nps_score ?? '–',
    ]),
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
  });

  if (includeDetails && items.length) {
    const byResponse = new Map<string, PdfItem[]>();
    items.forEach((i) => {
      const list = byResponse.get(i.response_id) ?? [];
      list.push(i);
      byResponse.set(i.response_id, list);
    });

    const pageH = doc.internal.pageSize.getHeight();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;

    doc.addPage();
    doc.setFontSize(13);
    doc.text('Einzelantworten', margin, 18);
    let y = 26;

    responses.forEach((r) => {
      const list = byResponse.get(r.id);
      if (!list?.length) return;

      if (y > pageH - 40) {
        doc.addPage();
        y = 20;
      }

      // Kopfzeile des Kunden
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 4.5, pageW - margin * 2, 7, 'F');
      doc.setFontSize(9.5);
      doc.setFont(undefined, 'bold');
      doc.text(recipientName(r), margin + 2, y);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(
        [fmtDate(r.completed_at ?? r.created_at), r.recipient?.email, r.status].filter(Boolean).join(' · '),
        pageW - margin - 2,
        y,
        { align: 'right' },
      );
      doc.setTextColor(0);
      y += 5;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        body: list.map((i) => [i.question_label ?? '–', i.value]),
        styles: { fontSize: 7.5, cellPadding: 1.2, valign: 'top', overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 62, textColor: 90 },
          1: { cellWidth: 'auto' },
        },
        theme: 'grid',
        tableLineColor: [225, 225, 225],
      });

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
    });
  }


  return doc;
}
