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
  return v ? new Date(v).toLocaleString('de-DE') : '–';
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
    head: [['Datum', 'Kunde', 'E-Mail', 'Status', 'Score', 'NPS', 'Dauer']],
    body: responses.map((r) => [
      fmtDate(r.completed_at ?? r.created_at),
      recipientName(r) + (r.is_critical ? ' (kritisch)' : ''),
      r.recipient?.email ?? '',
      r.status ?? '',
      r.score_total ?? '–',
      r.nps_score ?? '–',
      r.duration_seconds ? `${Math.round(r.duration_seconds / 60)} min` : '–',
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

    responses.forEach((r) => {
      const list = byResponse.get(r.id);
      if (!list?.length) return;
      doc.addPage();
      doc.setFontSize(13);
      doc.text(recipientName(r), 14, 18);
      doc.setFontSize(9);
      doc.setTextColor(110);
      doc.text(
        [fmtDate(r.completed_at ?? r.created_at), r.recipient?.email, r.status].filter(Boolean).join(' · '),
        14,
        24,
      );
      doc.setTextColor(0);
      autoTable(doc, {
        startY: 30,
        head: [['Frage', 'Antwort']],
        body: list.map((i) => [i.question_label ?? '–', i.value]),
        styles: { fontSize: 9, cellPadding: 2, valign: 'top' },
        columnStyles: { 0: { cellWidth: 70 } },
        headStyles: { fillColor: [30, 30, 30], textColor: 255 },
      });
    });
  }

  return doc;
}
