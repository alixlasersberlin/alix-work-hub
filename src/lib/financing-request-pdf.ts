import { createPDF } from './pdf-utils';

export interface FinancingRequestPdfData {
  orderNumber?: string | null;
  customerName?: string | null;
  customerAddress?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  purchasePrice?: number | string | null;
  downPayment?: number | string | null;
  termMonths?: number | string | null;
  residualValue?: number | string | null;
  requestDate?: string | null;
  totalAmount?: number | string | null;
  currency?: string | null;
  note?: string | null;
}

const fmtMoney = (v: any, c?: string | null) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(n);
  } catch {
    return `${n.toFixed(2)} ${c || 'EUR'}`;
  }
};

export function generateFinancingRequestPdf(data: FinancingRequestPdfData) {
  const doc = createPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 18;
  let y = 22;

  // Header
  doc.setFont('Inter', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15);
  doc.text('Leasing-Anfrage', marginX, y);

  doc.setFont('Inter', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text('Alix Lasers · Finanzierungsteam', pageW - marginX, y, { align: 'right' });
  y += 4;
  doc.text(
    `Erstellt am ${new Date().toLocaleDateString('de-DE')}`,
    pageW - marginX,
    y,
    { align: 'right' },
  );
  y += 8;

  doc.setDrawColor(220);
  doc.line(marginX, y, pageW - marginX, y);
  y += 8;

  doc.setFont('Inter', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(40);
  const intro =
    'anbei eine Finanzierungs-/Leasing-Anfrage zur Prüfung. Bitte um kurze Rückmeldung, sobald eine Entscheidung vorliegt.';
  const introLines = doc.splitTextToSize(intro, pageW - marginX * 2);
  doc.text('Guten Tag,', marginX, y);
  y += 6;
  doc.text(introLines, marginX, y);
  y += introLines.length * 5 + 4;

  const section = (title: string, rows: Array<[string, string]>) => {
    // Card background
    const rowH = 6.5;
    const headerH = 8;
    const bodyH = rows.length * rowH + 4;
    const totalH = headerH + bodyH;

    doc.setFillColor(250, 248, 243);
    doc.setDrawColor(236, 229, 211);
    doc.roundedRect(marginX, y, pageW - marginX * 2, totalH, 2, 2, 'FD');

    doc.setFont('Inter', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15);
    doc.text(title, marginX + 4, y + 6);

    let yy = y + headerH + 4;
    doc.setFont('Inter', 'normal');
    doc.setFontSize(10);
    rows.forEach(([label, value]) => {
      doc.setTextColor(119);
      doc.text(label, marginX + 4, yy);
      doc.setTextColor(15);
      doc.setFont('Inter', 'bold');
      const valLines = doc.splitTextToSize(String(value || '—'), pageW - marginX * 2 - 55);
      doc.text(valLines[0] || '—', marginX + 50, yy);
      doc.setFont('Inter', 'normal');
      yy += rowH;
    });

    y += totalH + 5;
  };

  section('Auftrag', [
    ['Auftragsnummer', data.orderNumber || '—'],
    ['Anfragedatum', data.requestDate || '—'],
    ['Gesamtbetrag', fmtMoney(data.totalAmount, data.currency)],
  ]);

  const customerRows: Array<[string, string]> = [['Name', data.customerName || '—']];
  if (data.customerAddress) customerRows.push(['Adresse', data.customerAddress]);
  if (data.customerEmail) customerRows.push(['E-Mail', data.customerEmail]);
  if (data.customerPhone) customerRows.push(['Telefon', data.customerPhone]);
  section('Kunde', customerRows);

  section('Konditionen', [
    ['Kaufpreis', fmtMoney(data.purchasePrice, data.currency)],
    ['Anzahlung', fmtMoney(data.downPayment, data.currency)],
    ['Laufzeit', data.termMonths ? `${data.termMonths} Monate` : '—'],
    ['Restwert', fmtMoney(data.residualValue, data.currency)],
  ]);

  if (data.note) {
    doc.setFillColor(250, 248, 243);
    doc.setDrawColor(236, 229, 211);
    const noteLines = doc.splitTextToSize(data.note, pageW - marginX * 2 - 8);
    const boxH = 12 + noteLines.length * 5;
    doc.roundedRect(marginX, y, pageW - marginX * 2, boxH, 2, 2, 'FD');
    doc.setFont('Inter', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15);
    doc.text('Anmerkung', marginX + 4, y + 6);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(40);
    doc.text(noteLines, marginX + 4, y + 12);
    y += boxH + 5;
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 14;
  doc.setDrawColor(220);
  doc.line(marginX, footerY - 4, pageW - marginX, footerY - 4);
  doc.setFont('Inter', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text('Alix Lasers · Mit freundlichen Grüßen, das Finanzierungsteam', marginX, footerY);

  return doc;
}
