// Gutschrift-PDF auf derselben Alix-Briefvorlage wie Rechnungen.
import { createAlixLetter, letterClosing, money, dateDe } from './alix-letter-pdf';

export type CreditNotePdfData = {
  creditNoteNumber: string;
  date: string;
  customerName: string;
  customerAddress?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  reason: string;
  isPartial: boolean;
  net: number;
  vat: number;
  vatRate: number;
  gross: number;
};

export async function generateCreditNotePdf(d: CreditNotePdfData) {
  const ctx = await createAlixLetter({
    customerName: d.customerName,
    customerAddress: d.customerAddress,
    title: `Gutschrift Nr. ${d.creditNoteNumber}`,
    reference: d.invoiceNumber ? `Rechnung ${d.invoiceNumber}` : null,
    intro:
      `hiermit erhalten Sie die Gutschrift ${d.creditNoteNumber} vom ${dateDe(d.date)}` +
      (d.invoiceNumber ? ` zur Rechnung ${d.invoiceNumber}${d.invoiceDate ? ` vom ${dateDe(d.invoiceDate)}` : ''}` : '') + '.',
  } as any);
  const { doc, m, right } = ctx;

  ctx.y += 4;
  doc.setFillColor(243, 240, 232);
  doc.rect(m, ctx.y - 5, right - m, 8, 'F');
  doc.setFont('Inter', 'bold'); doc.setFontSize(9); doc.setTextColor(40);
  doc.text('Position', m + 2, ctx.y);
  doc.text('Betrag', right - 2, ctx.y, { align: 'right' });
  ctx.y += 8;

  doc.setFont('Inter', 'normal'); doc.setTextColor(25);
  const title = d.isPartial ? 'Teilgutschrift' : 'Gutschrift über den vollen Rechnungsbetrag';
  doc.text(title, m + 2, ctx.y);
  doc.text(money(-d.net, 'EUR'), right - 2, ctx.y, { align: 'right' });
  ctx.y += 4.6;
  doc.setFontSize(8); doc.setTextColor(120);
  const rl = doc.splitTextToSize(`Grund: ${d.reason}`, 120) as string[];
  doc.text(rl, m + 2, ctx.y);
  ctx.y += rl.length * 4 + 3;
  doc.setDrawColor(228); doc.setLineWidth(0.2); doc.line(m, ctx.y - 1.5, right, ctx.y - 1.5);

  ctx.y += 5;
  const labelX = right - 55;
  doc.setFontSize(9.5); doc.setTextColor(60);
  doc.text('Nettobetrag', labelX, ctx.y, { align: 'right' });
  doc.text(money(-d.net, 'EUR'), right - 2, ctx.y, { align: 'right' });
  ctx.y += 5.5;
  doc.text(`USt. ${Number(d.vatRate).toFixed(0)} %`, labelX, ctx.y, { align: 'right' });
  doc.text(money(-d.vat, 'EUR'), right - 2, ctx.y, { align: 'right' });
  ctx.y += 7;
  doc.setFont('Inter', 'bold'); doc.setFontSize(11); doc.setTextColor(15);
  doc.text('Gutschriftbetrag', labelX, ctx.y, { align: 'right' });
  doc.text(money(-d.gross, 'EUR'), right - 2, ctx.y, { align: 'right' });

  ctx.y += 10;
  doc.setFont('Inter', 'normal'); doc.setFontSize(9); doc.setTextColor(70);
  doc.text('Der Betrag wird mit offenen Forderungen verrechnet bzw. Ihnen erstattet.', m, ctx.y);
  ctx.y += 6;

  letterClosing(ctx, 'Alix Lasers Finance');
  return doc;
}
