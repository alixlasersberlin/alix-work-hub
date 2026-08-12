// Rechnungs-PDF für intern erzeugte Rechnungen (nicht aus Zoho), auf der Alix-Briefvorlage.
import { createAlixLetter, letterClosing, money, dateDe, COMPANY } from './alix-letter-pdf';

export type InvoicePdfItem = {
  name: string;
  description?: string | null;
  quantity: number;
  rate: number;
};

export type InvoicePdfData = {
  invoiceNumber: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  customerName: string;
  customerAddress?: string | null;
  customerNumber?: string | null;
  reference?: string | null;
  currency?: string | null;
  taxRate?: number | null;
  items: InvoicePdfItem[];
  notes?: string | null;
};

/** Erzeugt das Rechnungs-PDF und liefert das jsPDF-Dokument zurück. */
export async function generateInvoicePdf(data: InvoicePdfData) {
  const cur = data.currency || 'EUR';
  const taxRate = Number(data.taxRate ?? 19);

  const ctx = await createAlixLetter({
    customerName: data.customerName,
    customerAddress: data.customerAddress,
    customerNumber: data.customerNumber,
    title: `Rechnung ${data.invoiceNumber}`,
    reference: data.reference || null,
    intro:
      `vielen Dank für Ihren Auftrag. Nachfolgend erhalten Sie die Rechnung ${data.invoiceNumber} ` +
      `vom ${dateDe(data.invoiceDate)}${data.dueDate ? `, zahlbar bis zum ${dateDe(data.dueDate)}` : ''}.`,
  });

  const { doc, m, right, footerTop } = ctx;

  const cols = {
    pos: m,
    menge: m + 96,
    preis: m + 122,
    betrag: right,
  };

  const drawHeader = () => {
    doc.setFillColor(243, 240, 232);
    doc.rect(m, ctx.y - 5, right - m, 8, 'F');
    doc.setFont('Inter', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(40);
    doc.text('Position', cols.pos + 2, ctx.y);
    doc.text('Menge', cols.menge, ctx.y, { align: 'right' });
    doc.text('Einzelpreis', cols.preis, ctx.y, { align: 'right' });
    doc.text('Betrag', cols.betrag - 2, ctx.y, { align: 'right' });
    ctx.y += 8;
  };

  ctx.y += 4;
  drawHeader();

  let subtotal = 0;
  doc.setFont('Inter', 'normal');
  doc.setFontSize(9);
  for (const it of data.items) {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.rate) || 0;
    const amount = qty * rate;
    subtotal += amount;

    const nameLines = doc.splitTextToSize(it.name || '', 90) as string[];
    const descLines = it.description
      ? (doc.splitTextToSize(String(it.description), 90) as string[])
      : [];
    const blockH = nameLines.length * 4.6 + descLines.length * 4 + 4;

    if (ctx.y + blockH > footerTop - 40) {
      doc.addPage();
      ctx.paintPage();
      ctx.y = 40;
      drawHeader();
      doc.setFont('Inter', 'normal');
      doc.setFontSize(9);
    }

    doc.setTextColor(25);
    doc.text(nameLines, cols.pos + 2, ctx.y);
    doc.text(String(qty), cols.menge, ctx.y, { align: 'right' });
    doc.text(money(rate, cur), cols.preis, ctx.y, { align: 'right' });
    doc.text(money(amount, cur), cols.betrag - 2, ctx.y, { align: 'right' });

    let inner = ctx.y + nameLines.length * 4.6;
    if (descLines.length) {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(descLines, cols.pos + 2, inner);
      inner += descLines.length * 4;
      doc.setFontSize(9);
      doc.setTextColor(25);
    }

    ctx.y = inner + 3;
    doc.setDrawColor(228);
    doc.setLineWidth(0.2);
    doc.line(m, ctx.y - 1.5, right, ctx.y - 1.5);
  }

  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  if (ctx.y + 30 > footerTop - 20) {
    doc.addPage();
    ctx.paintPage();
    ctx.y = 40;
  }

  ctx.y += 5;
  const labelX = right - 55;
  doc.setFont('Inter', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(60);
  doc.text('Zwischensumme', labelX, ctx.y, { align: 'right' });
  doc.text(money(subtotal, cur), right - 2, ctx.y, { align: 'right' });
  ctx.y += 5.5;
  doc.text(`USt. ${taxRate.toFixed(0)} %`, labelX, ctx.y, { align: 'right' });
  doc.text(money(tax, cur), right - 2, ctx.y, { align: 'right' });
  ctx.y += 7;
  doc.setFont('Inter', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15);
  doc.text('Gesamtbetrag', labelX, ctx.y, { align: 'right' });
  doc.text(money(total, cur), right - 2, ctx.y, { align: 'right' });

  ctx.y += 10;
  doc.setFont('Inter', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70);
  const payText = `Bitte überweisen Sie den Betrag${data.dueDate ? ` bis zum ${dateDe(data.dueDate)}` : ''} ` +
    `unter Angabe der Rechnungsnummer ${data.invoiceNumber} auf: ${COMPANY.bank}, IBAN ${COMPANY.iban}, BIC ${COMPANY.bic}.`;
  const payLines = doc.splitTextToSize(payText, right - m) as string[];
  doc.text(payLines, m, ctx.y);
  ctx.y += payLines.length * 4.6;

  if (data.notes && data.notes.trim()) {
    ctx.y += 4;
    const noteLines = doc.splitTextToSize(data.notes.trim(), right - m) as string[];
    doc.setTextColor(90);
    doc.text(noteLines, m, ctx.y);
    ctx.y += noteLines.length * 4.6;
  }

  letterClosing(ctx, 'Alix Lasers Finance');

  return { doc, subtotal, tax, total };
}

/** Rechnung als Base64 (ohne data:-Präfix) für den E-Mail-Anhang. */
export async function generateInvoicePdfBase64(data: InvoicePdfData): Promise<string> {
  const { doc } = await generateInvoicePdf(data);
  const dataUri = doc.output('datauristring') as string;
  return dataUri.split(',')[1] ?? '';
}
