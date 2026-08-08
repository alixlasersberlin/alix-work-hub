// Mahnschreiben auf derselben Alix-Briefvorlage wie der Kontoauszug.
import { createAlixLetter, letterClosing, money, dateDe as date, daysOverdue, COMPANY } from './alix-letter-pdf';

export type MahnungItem = {
  invoice_number?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  balance?: number | null;
  total?: number | null;
  currency?: string | null;
  days_overdue?: number | null;
};

export type MahnungData = {
  customerName: string;
  customerAddress?: string | null;
  customerNumber?: string | null;
  currency?: string | null;
  /** Bezeichnung der Mahnstufe, z. B. „Mahnstufe 2“ */
  stageLabel: string;
  /** Einleitungstext nach der Anrede */
  intro?: string | null;
  items: MahnungItem[];
  openAmount?: number | null;
  feeAmount?: number | null;
  interestAmount?: number | null;
  /** optionales Zahlungsziel */
  payUntil?: string | null;
};

/** Erzeugt ein Mahnschreiben (identisches Layout wie der Kontoauszug). */
export async function generateMahnungPdf(data: MahnungData) {
  const cur = data.currency || 'EUR';
  const ctx = await createAlixLetter({
    customerName: data.customerName,
    customerAddress: data.customerAddress,
    customerNumber: data.customerNumber,
    title: data.stageLabel || 'Zahlungserinnerung',
    reference: data.stageLabel || null,
    intro:
      data.intro?.trim() ||
      'nachfolgend erhalten Sie eine Aufstellung der derzeit offenen Posten Ihres Kundenkontos. ' +
        'Bitte gleichen Sie den Gesamtbetrag zeitnah aus. Sollten sich Zahlungen mit diesem Schreiben ' +
        'überschnitten haben, betrachten Sie es bitte als gegenstandslos.',
  });

  const { doc, m, right, footerTop } = ctx;

  const cols = {
    nr: m,
    datum: m + 38,
    faellig: m + 62,
    tage: m + 86,
    offen: right,
  };
  const header = () => {
    doc.setFillColor(243, 240, 232);
    doc.rect(m, ctx.y - 5, right - m, 8, 'F');
    doc.setFont('Inter', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text('Rechnung', cols.nr + 2, ctx.y);
    doc.text('Datum', cols.datum, ctx.y);
    doc.text('Fällig', cols.faellig, ctx.y);
    doc.text('Verzug', cols.tage, ctx.y);
    doc.text('Offen', cols.offen - 2, ctx.y, { align: 'right' });
    ctx.y += 8;
  };
  header();

  doc.setFont('Inter', 'normal');
  doc.setFontSize(9);
  let sumOpen = 0;

  data.items.forEach((it, i) => {
    if (ctx.y > footerTop - 40) {
      doc.addPage();
      ctx.paintPage();
      ctx.y = 30;
      header();
      doc.setFont('Inter', 'normal');
      doc.setFontSize(9);
    }
    if (i % 2 === 1) {
      doc.setFillColor(250, 250, 248);
      doc.rect(m, ctx.y - 4.5, right - m, 7, 'F');
    }
    const open = Number(it.balance ?? it.total ?? 0);
    const od = it.days_overdue != null ? Number(it.days_overdue) : daysOverdue(it.due_date);
    sumOpen += open;

    doc.setTextColor(30);
    doc.text(String(it.invoice_number || '—').slice(0, 22), cols.nr + 2, ctx.y);
    doc.setTextColor(90);
    doc.text(date(it.invoice_date), cols.datum, ctx.y);
    doc.text(date(it.due_date), cols.faellig, ctx.y);
    if (od > 0) doc.setTextColor(190, 60, 40);
    doc.text(od > 0 ? `${od} Tage` : '—', cols.tage, ctx.y);
    doc.setFont('Inter', 'bold');
    doc.setTextColor(30);
    doc.text(money(open, it.currency || cur), cols.offen - 2, ctx.y, { align: 'right' });
    doc.setFont('Inter', 'normal');
    ctx.y += 7;
  });

  if (!data.items.length) {
    doc.setTextColor(120);
    doc.text('Keine offenen Positionen vorhanden.', m + 2, ctx.y);
    ctx.y += 7;
  }

  const open = Number(data.openAmount ?? sumOpen);
  const fee = Number(data.feeAmount ?? 0);
  const interest = Number(data.interestAmount ?? 0);
  const total = open + fee + interest;

  const boxH = 14 + (fee > 0 ? 6 : 0) + (interest > 0 ? 6 : 0);
  ctx.y += 3;
  if (ctx.y > footerTop - (boxH + 14)) { doc.addPage(); ctx.paintPage(); ctx.y = 30; }
  doc.setDrawColor(220);
  doc.line(m, ctx.y, right, ctx.y);
  ctx.y += 8;
  doc.setFillColor(250, 248, 243);
  doc.setDrawColor(236, 229, 211);
  doc.roundedRect(right - 90, ctx.y - 6, 90, boxH + 6, 2, 2, 'FD');

  doc.setFont('Inter', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(110);
  let ly = ctx.y;
  doc.text('Offene Posten', right - 86, ly, { align: 'left' });
  doc.text(money(open, cur), right - 4, ly, { align: 'right' });
  if (fee > 0) {
    ly += 6;
    doc.text('Mahngebühren', right - 86, ly, { align: 'left' });
    doc.text(money(fee, cur), right - 4, ly, { align: 'right' });
  }
  if (interest > 0) {
    ly += 6;
    doc.text('Verzugszinsen', right - 86, ly, { align: 'left' });
    doc.text(money(interest, cur), right - 4, ly, { align: 'right' });
  }
  ly += 8;
  doc.setFont('Inter', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15);
  doc.text('Gesamtbetrag', right - 86, ly, { align: 'left' });
  doc.text(money(total, cur), right - 4, ly, { align: 'right' });
  ctx.y = ly;

  // Zahlungshinweis
  ctx.y += 12;
  if (ctx.y > footerTop - 20) { doc.addPage(); ctx.paintPage(); ctx.y = 34; }
  doc.setFont('Inter', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(70);
  const payText = doc.splitTextToSize(
    `Bitte überweisen Sie den Gesamtbetrag${data.payUntil ? ` bis zum ${date(data.payUntil)}` : ' innerhalb der nächsten 7 Tage'} ` +
      `auf folgendes Konto: ${COMPANY.bank}, IBAN ${COMPANY.iban}, BIC ${COMPANY.bic}. ` +
      'Bitte geben Sie die Rechnungsnummer(n) als Verwendungszweck an.',
    right - m,
  ) as string[];
  doc.text(payText, m, ctx.y);
  ctx.y += payText.length * 5;

  letterClosing(ctx, 'Alix Lasers Finance – Buchhaltung');

  return doc;
}
