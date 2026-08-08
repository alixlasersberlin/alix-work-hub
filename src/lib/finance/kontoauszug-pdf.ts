import { createPDF } from '../pdf-utils';
import kontoauszugBg from '@/assets/kontoauszug-vorlage.png.asset.json';

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

/** Lädt die Alix-Briefvorlage einmalig als DataURL (PDF-Hintergrund). */
let bgPromise: Promise<string | null> | null = null;
export function loadKontoauszugBackground(): Promise<string | null> {
  if (!bgPromise) {
    bgPromise = fetch((kontoauszugBg as any).url)
      .then((r) => r.blob())
      .then((b) => new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = rej;
        fr.readAsDataURL(b);
      }))
      .catch(() => null);
  }
  return bgPromise;
}

const COMPANY = {
  name: 'Alix Lasers GmbH',
  street: 'Buchsbaumweg 53',
  city: '12357 Berlin',
  country: 'Deutschland',
  phone: '+49 30 577 127 45',
  fax: '+49 30 577 127 46',
  mail: 'info@alix-lasers.com',
  bank: 'Deutsche Bank',
  iban: 'DE07 1007 0100 0142 6600 00',
  bic: 'DEUTDEBB101',
};

/** Erzeugt den Kontoauszug (offene Posten) auf der Alix-Briefvorlage. */
export async function generateKontoauszugPdf(data: KontoauszugData) {
  const doc = createPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const bg = await loadKontoauszugBackground();

  const m = 28;                 // links: rechts vom blauen Balken
  const right = pageW - 15;
  const footerTop = pageH - 34;
  const cur = data.currency || 'EUR';

  const paintPage = () => {
    if (bg) {
      try { doc.addImage(bg, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST'); } catch { /* ignore */ }
    }
    // Falzmarken (DIN 5008) + Lochmarke
    doc.setDrawColor(120);
    doc.setLineWidth(0.3);
    [87, 148.5, 192].forEach((yy) => doc.line(19, yy, 25, yy));

    // Fußzeile: Anschrift + Bankverbindung
    doc.setDrawColor(215);
    doc.setLineWidth(0.2);
    doc.line(m, footerTop, right, footerTop);
    doc.setFont('Inter', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(60);
    doc.text(COMPANY.name, m, footerTop + 5);
    doc.setFont('Inter', 'normal');
    doc.setTextColor(120);
    doc.text(`${COMPANY.street} · ${COMPANY.city} · ${COMPANY.country}`, m, footerTop + 9);
    doc.text(`Telefon ${COMPANY.phone} · Fax ${COMPANY.fax} · ${COMPANY.mail}`, m, footerTop + 13);
    doc.setFont('Inter', 'bold');
    doc.setTextColor(60);
    doc.text('Bankverbindung', right, footerTop + 5, { align: 'right' });
    doc.setFont('Inter', 'normal');
    doc.setTextColor(120);
    doc.text(`${COMPANY.bank} · IBAN ${COMPANY.iban}`, right, footerTop + 9, { align: 'right' });
    doc.text(`BIC ${COMPANY.bic}`, right, footerTop + 13, { align: 'right' });
    doc.setTextColor(20);
  };

  paintPage();

  // Absenderdaten oben rechts
  let y = 26;
  doc.setFont('Inter', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30);
  doc.text(COMPANY.name, right, y, { align: 'right' });
  doc.setFont('Inter', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(120);
  doc.text(COMPANY.street, right, y + 4.5, { align: 'right' });
  doc.text(COMPANY.city, right, y + 9, { align: 'right' });
  doc.text(`Tel. ${COMPANY.phone}`, right, y + 13.5, { align: 'right' });
  doc.text(COMPANY.mail, right, y + 18, { align: 'right' });

  // Anschriftenfeld (Empfänger) oben links
  const hasShipping = !!(data.shippingAddress && String(data.shippingAddress).trim());
  doc.setFont('Inter', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(150);
  doc.text(`${COMPANY.name} · ${COMPANY.street} · ${COMPANY.city}`, m, 42);
  if (hasShipping) {
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text('Rechnungsanschrift', m, 46.5);
  }
  doc.setFont('Inter', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(data.customerName, m, 50);
  doc.setFont('Inter', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(70);
  const addrLines = doc.splitTextToSize(data.customerAddress || '', 80) as string[];
  if (addrLines.length) doc.text(addrLines, m, 55.5);

  // Lieferanschrift (nur wenn abweichend vorhanden)
  if (hasShipping) {
    const sx = 110;
    doc.setFont('Inter', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text('Lieferanschrift', sx, 46.5);
    doc.setFont('Inter', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(data.customerName, sx, 50);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(70);
    const shipLines = doc.splitTextToSize(String(data.shippingAddress || ''), 75) as string[];
    if (shipLines.length) doc.text(shipLines, sx, 55.5);
  }

  // Titel
  y = 92;
  doc.setFont('Inter', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15);
  doc.text(data.showAll ? 'Kontoauszug – alle Buchungen' : 'Kontoauszug', m, y);
  doc.setFont('Inter', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')}`, right, y, { align: 'right' });
  if (data.customerNumber) {
    doc.text(`Kundennr.: ${data.customerNumber}`, right, y - 5, { align: 'right' });
  }
  y += 10;

  // Anrede + Einleitungstext
  doc.setFont('Inter', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40);
  doc.text(`Sehr geehrte Damen und Herren${data.customerName ? ` von ${data.customerName}` : ''},`, m, y);
  y += 6;
  const intro = doc.splitTextToSize(
    data.showAll
      ? 'anbei erhalten Sie den aktuellen Kontoauszug Ihres Kundenkontos mit einer vollständigen Aufstellung aller Buchungen ' +
        '(bezahlte und offene Rechnungen). Bitte prüfen Sie die aufgeführten Positionen und gleichen Sie offene Beträge zeitnah aus. ' +
        'Sollten sich Zahlungen mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.'
      : 'anbei erhalten Sie den aktuellen Kontoauszug Ihres Kundenkontos mit einer Aufstellung aller offenen Posten. ' +
        'Bitte prüfen Sie die aufgeführten Positionen und gleichen Sie offene Beträge zeitnah aus. ' +
        'Sollten sich Zahlungen mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.',
    right - m,
  ) as string[];
  doc.text(intro, m, y);
  y += intro.length * 5 + 6;


  // Tabellenkopf
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
    doc.rect(m, y - 5, right - m, 8, 'F');
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
    if (y > footerTop - 34) {
      doc.addPage();
      paintPage();
      y = 30;
      header();
      doc.setFont('Inter', 'normal');
      doc.setFontSize(9);
    }
    if (i % 2 === 1) {
      doc.setFillColor(250, 250, 248);
      doc.rect(m, y - 4.5, right - m, 7, 'F');
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
  if (y > footerTop - 26) { doc.addPage(); paintPage(); y = 30; }
  doc.setDrawColor(220);
  doc.line(m, y, right, y);
  y += 8;
  doc.setFillColor(250, 248, 243);
  doc.setDrawColor(236, 229, 211);
  doc.roundedRect(right - 90, y - 6, 90, 20, 2, 2, 'FD');
  doc.setFont('Inter', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(110);
  doc.text('Rechnungsbetrag gesamt', right - 86, y, { align: 'left' });
  doc.text(money(sumTotal, cur), right - 4, y, { align: 'right' });
  doc.setFont('Inter', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15);
  doc.text('Offener Gesamtsaldo', right - 86, y + 8, { align: 'left' });
  doc.text(money(sumOpen, cur), right - 4, y + 8, { align: 'right' });

  // Grußformel
  y += 26;
  if (y > footerTop - 22) { doc.addPage(); paintPage(); y = 40; }
  doc.setFont('Inter', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40);
  doc.text('Mit freundlichen Grüßen', m, y);
  doc.setFont('Inter', 'bold');
  doc.setTextColor(20);
  doc.text('Alix Lasers Finance', m, y + 7);

  return doc;

}
