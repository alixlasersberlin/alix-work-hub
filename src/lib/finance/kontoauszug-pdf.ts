import {
  createAlixLetter,
  letterClosing,
  money,
  dateDe as date,
  daysOverdue,
  loadLetterBackground,
} from './alix-letter-pdf';

export type KontoauszugItem = {
  invoice_number: string;
  invoice_date?: string | null;
  due_date?: string | null;
  total?: number | null;
  balance?: number | null;
  status?: string | null;
  currency?: string | null;
};

export type KontoauszugData = {
  customerName: string;
  customerAddress?: string | null;
  shippingAddress?: string | null;
  customerNumber?: string | null;
  currency?: string | null;
  items: KontoauszugItem[];
  /** true = alle Buchungen (inkl. bezahlter Rechnungen), false = nur offene Posten */
  showAll?: boolean;
};

/** Rückwärtskompatibler Alias – die Vorlage wird jetzt zentral geladen. */
export const loadKontoauszugBackground = loadLetterBackground;

/** Erzeugt den Kontoauszug (offene Posten) auf der Alix-Briefvorlage. */
export async function generateKontoauszugPdf(data: KontoauszugData) {
  const cur = data.currency || 'EUR';
  const ctx = await createAlixLetter({
    customerName: data.customerName,
    customerAddress: data.customerAddress,
    shippingAddress: data.shippingAddress,
    customerNumber: data.customerNumber,
    title: data.showAll ? 'Kontoauszug – alle Buchungen' : 'Kontoauszug',
    intro: data.showAll
      ? 'anbei erhalten Sie den aktuellen Kontoauszug Ihres Kundenkontos mit einer vollständigen Aufstellung aller Buchungen ' +
        '(bezahlte und offene Rechnungen). Bitte prüfen Sie die aufgeführten Positionen und gleichen Sie offene Beträge zeitnah aus. ' +
        'Sollten sich Zahlungen mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.'
      : 'anbei erhalten Sie den aktuellen Kontoauszug Ihres Kundenkontos mit einer Aufstellung aller offenen Posten. ' +
        'Bitte prüfen Sie die aufgeführten Positionen und gleichen Sie offene Beträge zeitnah aus. ' +
        'Sollten sich Zahlungen mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.',
  });

  const { doc, m, right, footerTop } = ctx;

  const cols = {
    nr: m,
    datum: m + 38,
    faellig: m + 62,
    tage: m + 86,
    total: right - 34,
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
    doc.text(data.showAll ? 'Status' : 'Verzug', cols.tage, ctx.y);
    doc.text('Betrag', cols.total, ctx.y, { align: 'right' });
    doc.text('Offen', cols.offen - 2, ctx.y, { align: 'right' });
    ctx.y += 8;
  };
  header();

  doc.setFont('Inter', 'normal');
  doc.setFontSize(9);
  let sumTotal = 0;
  let sumOpen = 0;

  data.items.forEach((it, i) => {
    if (ctx.y > footerTop - 34) {
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
    const paid = data.showAll && !(open > 0);
    const od = paid ? 0 : daysOverdue(it.due_date);
    sumTotal += Number(it.total ?? 0);
    sumOpen += open;

    doc.setTextColor(30);
    doc.text(String(it.invoice_number || '—').slice(0, 22), cols.nr + 2, ctx.y);
    doc.setTextColor(90);
    doc.text(date(it.invoice_date), cols.datum, ctx.y);
    doc.text(date(it.due_date), cols.faellig, ctx.y);
    if (paid) doc.setTextColor(40, 140, 80);
    else if (od > 0) doc.setTextColor(190, 60, 40);
    doc.text(paid ? 'bezahlt' : od > 0 ? `${od} Tage` : data.showAll ? 'offen' : '—', cols.tage, ctx.y);
    doc.setTextColor(90);
    doc.text(money(it.total, it.currency || cur), cols.total, ctx.y, { align: 'right' });
    doc.setFont('Inter', 'bold');
    doc.setTextColor(30);
    doc.text(money(open, it.currency || cur), cols.offen - 2, ctx.y, { align: 'right' });
    doc.setFont('Inter', 'normal');
    ctx.y += 7;
  });

  if (!data.items.length) {
    doc.setTextColor(120);
    doc.text(data.showAll ? 'Keine Buchungen vorhanden.' : 'Keine offenen Posten vorhanden.', m + 2, ctx.y);
    ctx.y += 7;
  }

  // Summe
  ctx.y += 3;
  if (ctx.y > footerTop - 26) { doc.addPage(); ctx.paintPage(); ctx.y = 30; }
  doc.setDrawColor(220);
  doc.line(m, ctx.y, right, ctx.y);
  ctx.y += 8;
  doc.setFillColor(250, 248, 243);
  doc.setDrawColor(236, 229, 211);
  doc.roundedRect(right - 90, ctx.y - 6, 90, 20, 2, 2, 'FD');
  doc.setFont('Inter', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(110);
  doc.text('Rechnungsbetrag gesamt', right - 86, ctx.y, { align: 'left' });
  doc.text(money(sumTotal, cur), right - 4, ctx.y, { align: 'right' });
  doc.setFont('Inter', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15);
  doc.text('Offener Gesamtsaldo', right - 86, ctx.y + 8, { align: 'left' });
  doc.text(money(sumOpen, cur), right - 4, ctx.y + 8, { align: 'right' });

  letterClosing(ctx);

  return doc;
}
