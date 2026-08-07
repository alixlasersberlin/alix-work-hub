import { createPDF } from '../pdf-utils';

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
  customerNumber?: string | null;
  currency?: string | null;
  items: KontoauszugItem[];
};

const money = (v?: number | null, c?: string | null) => {
  const n = Number(v ?? 0);
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(n);
  } catch {
    return `${n.toFixed(2)} ${c || 'EUR'}`;
  }
};

const date = (d?: string | null) => {
  if (!d) return '—';
  const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('de-DE');
};

const daysOverdue = (due?: string | null) => {
  if (!due) return 0;
  const dt = new Date(`${due.slice(0, 10)}T00:00:00`);
  if (isNaN(dt.getTime())) return 0;
  const diff = Math.floor((Date.now() - dt.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
};

/** Erzeugt den Kontoauszug (offene Posten) im Alix-Layout wie bei Rechnungen. */
export function generateKontoauszugPdf(data: KontoauszugData) {
  const doc = createPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = 18;
  const cur = data.currency || 'EUR';
  let y = 22;

  // Kopf
  doc.setFont('Inter', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15);
  doc.text('Kontoauszug', m, y);

  doc.setFont('Inter', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text('Alix Lasers ®', pageW - m, y, { align: 'right' });
  y += 4;
  doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')}`, pageW - m, y, { align: 'right' });
  y += 8;

  doc.setDrawColor(220);
  doc.line(m, y, pageW - m, y);
  y += 8;

  // Kundenblock
  doc.setFillColor(250, 248, 243);
  doc.setDrawColor(236, 229, 211);
  const addrLines = doc.splitTextToSize(data.customerAddress || '', pageW / 2 - m) as string[];
  const boxH = 14 + addrLines.length * 5;
  doc.roundedRect(m, y, pageW - m * 2, boxH, 2, 2, 'FD');
  doc.setFont('Inter', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15);
  doc.text(data.customerName, m + 4, y + 7);
  doc.setFont('Inter', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(90);
  if (addrLines.length) doc.text(addrLines, m + 4, y + 13);
  if (data.customerNumber) {
    doc.text(`Kundennr.: ${data.customerNumber}`, pageW - m - 4, y + 7, { align: 'right' });
  }
  y += boxH + 8;

  // Tabellenkopf
  const cols = {
    nr: m,
    datum: m + 40,
    faellig: m + 66,
    tage: m + 92,
    total: pageW - m - 62,
    offen: pageW - m,
  };
  const header = () => {
    doc.setFillColor(243, 240, 232);
    doc.rect(m, y - 5, pageW - m * 2, 8, 'F');
    doc.setFont('Inter', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text('Rechnung', cols.nr + 2, y);
    doc.text('Datum', cols.datum, y);
    doc.text('Fällig', cols.faellig, y);
    doc.text('Verzug', cols.tage, y);
    doc.text('Betrag', cols.total, y, { align: 'right' });
    doc.text('Offen', cols.offen - 2, y, { align: 'right' });
    y += 8;
  };
  header();

  doc.setFont('Inter', 'normal');
  doc.setFontSize(9);
  let sumTotal = 0;
  let sumOpen = 0;

  data.items.forEach((it, i) => {
    if (y > pageH - 40) {
      doc.addPage();
      y = 22;
      header();
      doc.setFont('Inter', 'normal');
      doc.setFontSize(9);
    }
    if (i % 2 === 1) {
      doc.setFillColor(250, 250, 248);
      doc.rect(m, y - 4.5, pageW - m * 2, 7, 'F');
    }
    const od = daysOverdue(it.due_date);
    sumTotal += Number(it.total ?? 0);
    sumOpen += Number(it.balance ?? it.total ?? 0);

    doc.setTextColor(30);
    doc.text(String(it.invoice_number || '—').slice(0, 22), cols.nr + 2, y);
    doc.setTextColor(90);
    doc.text(date(it.invoice_date), cols.datum, y);
    doc.text(date(it.due_date), cols.faellig, y);
    if (od > 0) doc.setTextColor(190, 60, 40);
    doc.text(od > 0 ? `${od} Tage` : '—', cols.tage, y);
    doc.setTextColor(90);
    doc.text(money(it.total, it.currency || cur), cols.total, y, { align: 'right' });
    doc.setFont('Inter', 'bold');
    doc.setTextColor(30);
    doc.text(money(it.balance ?? it.total, it.currency || cur), cols.offen - 2, y, { align: 'right' });
    doc.setFont('Inter', 'normal');
    y += 7;
  });

  if (!data.items.length) {
    doc.setTextColor(120);
    doc.text('Keine offenen Posten vorhanden.', m + 2, y);
    y += 7;
  }

  // Summe
  y += 3;
  doc.setDrawColor(220);
  doc.line(m, y, pageW - m, y);
  y += 8;
  doc.setFillColor(250, 248, 243);
  doc.setDrawColor(236, 229, 211);
  doc.roundedRect(pageW - m - 90, y - 6, 90, 20, 2, 2, 'FD');
  doc.setFont('Inter', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(110);
  doc.text('Rechnungsbetrag gesamt', pageW - m - 86, y, { align: 'left' });
  doc.text(money(sumTotal, cur), pageW - m - 4, y, { align: 'right' });
  doc.setFont('Inter', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15);
  doc.text('Offener Gesamtsaldo', pageW - m - 86, y + 8, { align: 'left' });
  doc.text(money(sumOpen, cur), pageW - m - 4, y + 8, { align: 'right' });

  // Fuß
  doc.setFont('Inter', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(
    'Alix Lasers ® · Kontoauszug offener Posten · Stand: ' + new Date().toLocaleString('de-DE'),
    m,
    pageH - 12,
  );

  return doc;
}
