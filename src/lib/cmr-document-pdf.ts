import autoTable from 'jspdf-autotable';
import { createPDF } from './pdf-utils';
import type { CmrSettings } from '@/hooks/useCmrTenant';
import { CMR_DOC_TYPES } from '@/hooks/useCmrTenant';

export interface CmrPdfDoc {
  doc_type: string;
  doc_number: string | null;
  doc_date: string;
  due_date?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  billing_address?: string | null;
  reference?: string | null;
  notes?: string | null;
  currency?: string | null;
  net_total: number;
  tax_total: number;
  gross_total: number;
}

export interface CmrPdfLine {
  position: number;
  name: string;
  description?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  discount_pct?: number | null;
  tax_rate?: number | null;
  line_total: number;
}

const money = (v: number | null | undefined, c = 'AED') => {
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: c }).format(Number(v || 0));
  } catch {
    return `${Number(v || 0).toFixed(2)} ${c}`;
  }
};

const dt = (v?: string | null) => (v ? new Date(v).toLocaleDateString('de-DE') : '—');

/** Erzeugt das PDF eines CMR-Belegs. Nur für den Mandanten CMR – kein Einfluss auf Alix-Lasers-Belege. */
export function generateCmrDocumentPdf(doc_: CmrPdfDoc, lines: CmrPdfLine[], s: CmrSettings | null) {
  const pdf = createPDF({ unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const mX = 18;
  const cur = doc_.currency || s?.default_currency || 'AED';
  const label = CMR_DOC_TYPES.find((t) => t.value === doc_.doc_type)?.label ?? doc_.doc_type;
  let y = 20;

  // Kopf
  pdf.setFont('Inter', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(15);
  pdf.text(s?.company_name || 'Cloud Marketing Research', mX, y);

  pdf.setFont('Inter', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(110);
  const contact = [s?.address_line1, s?.address_line2, s?.address_line3, [s?.city, s?.country].filter(Boolean).join(', '), s?.phone, s?.email, s?.website]
    .filter(Boolean) as string[];
  let ry = y - 4;
  contact.forEach((c) => { pdf.text(String(c), pageW - mX, (ry += 4), { align: 'right' }); });

  y = Math.max(y + 10, ry + 8);
  pdf.setDrawColor(220);
  pdf.line(mX, y, pageW - mX, y);
  y += 10;

  // Empfänger
  pdf.setFont('Inter', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(15);
  pdf.text(doc_.customer_name || 'Kunde', mX, y);
  pdf.setFont('Inter', 'normal');
  pdf.setTextColor(80);
  (doc_.billing_address || '').split('\n').filter(Boolean).forEach((l) => { pdf.text(l, mX, (y += 5)); });
  if (doc_.customer_email) pdf.text(doc_.customer_email, mX, (y += 5));

  // Belegkopf rechts
  let hy = y - 10;
  pdf.setFont('Inter', 'bold');
  pdf.setFontSize(15);
  pdf.setTextColor(15);
  pdf.text(label, pageW - mX, hy, { align: 'right' });
  pdf.setFont('Inter', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(90);
  pdf.text(`Nr. ${doc_.doc_number ?? '—'}`, pageW - mX, (hy += 6), { align: 'right' });
  pdf.text(`Datum ${dt(doc_.doc_date)}`, pageW - mX, (hy += 4.5), { align: 'right' });
  if (doc_.due_date) pdf.text(`Fällig ${dt(doc_.due_date)}`, pageW - mX, (hy += 4.5), { align: 'right' });
  if (doc_.reference) pdf.text(`Referenz ${doc_.reference}`, pageW - mX, (hy += 4.5), { align: 'right' });

  y = Math.max(y, hy) + 10;

  // Positionen
  autoTable(pdf, {
    startY: y,
    head: [['Pos', 'Bezeichnung', 'Menge', 'Einheit', 'Einzelpreis', 'Rabatt', 'MwSt.', 'Betrag']],
    body: lines.map((l, i) => [
      String(l.position ?? i + 1),
      l.description ? `${l.name}\n${l.description}` : l.name,
      String(l.quantity),
      l.unit || '',
      money(l.unit_price, cur),
      `${Number(l.discount_pct || 0)} %`,
      `${Number(l.tax_rate || 0)} %`,
      money(l.line_total, cur),
    ]),
    styles: { font: 'Inter', fontSize: 9, cellPadding: 2, textColor: 40 },
    headStyles: { font: 'Inter', fontStyle: 'bold', fillColor: [24, 24, 27], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 10 },
      2: { halign: 'right', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 16 },
      6: { halign: 'right', cellWidth: 14 },
      7: { halign: 'right', cellWidth: 26 },
    },
    margin: { left: mX, right: mX },
  });

  y = (pdf as any).lastAutoTable.finalY + 8;

  // Summen
  const boxX = pageW - mX - 70;
  const row = (l: string, v: string, bold = false) => {
    pdf.setFont('Inter', bold ? 'bold' : 'normal');
    pdf.setFontSize(bold ? 11 : 10);
    pdf.setTextColor(bold ? 15 : 80);
    pdf.text(l, boxX, y);
    pdf.text(v, pageW - mX, y, { align: 'right' });
    y += bold ? 7 : 5.5;
  };
  row('Nettobetrag', money(doc_.net_total, cur));
  row('MwSt.', money(doc_.tax_total, cur));
  pdf.setDrawColor(200);
  pdf.line(boxX, y - 3, pageW - mX, y - 3);
  y += 2;
  row('Gesamtbetrag', money(doc_.gross_total, cur), true);

  // Hinweise
  y += 4;
  pdf.setFont('Inter', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(90);
  const notes = [doc_.notes, s?.payment_terms, s?.tax_note].filter(Boolean) as string[];
  notes.forEach((n) => {
    const wrapped = pdf.splitTextToSize(String(n), pageW - 2 * mX);
    pdf.text(wrapped, mX, y);
    y += wrapped.length * 4.5 + 2;
  });

  // Fußzeile
  const footer = [
    s?.bank_name ? `Bank: ${s.bank_name}` : null,
    s?.bank_iban ? `IBAN: ${s.bank_iban}` : null,
    s?.bank_bic ? `BIC: ${s.bank_bic}` : null,
    s?.bank_account ? `Konto: ${s.bank_account}` : null,
  ].filter(Boolean).join('  ·  ');
  if (footer) {
    pdf.setFontSize(8);
    pdf.setTextColor(130);
    pdf.text(footer, pageW / 2, pageH - 12, { align: 'center' });
  }

  return pdf;
}

export function cmrPdfFilename(d: CmrPdfDoc) {
  const label = CMR_DOC_TYPES.find((t) => t.value === d.doc_type)?.label ?? d.doc_type;
  return `CMR_${label}_${d.doc_number ?? 'Entwurf'}.pdf`.replace(/\s+/g, '_');
}
