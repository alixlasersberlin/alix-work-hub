// Gemeinsame Alix-Briefvorlage für alle Finanz-Schreiben (Kontoauszug, Mahnungen, …).
// Enthält Hintergrund, Kopf-/Fußzeile, Anschriftenfeld, Titel und Anrede.
import { createPDF } from '../pdf-utils';
import kontoauszugBg from '@/assets/kontoauszug-vorlage.png.asset.json';

export const COMPANY = {
  name: 'Alix Lasers GmbH',
  street: 'Zeppelin Straße 3',
  city: '12529 Berlin- Schönefeld',
  country: 'Deutschland',
  phone: '+49 30 577 127 45',
  fax: '+49 30 577 127 46',
  mail: 'service@alix-lasers.com',
  bank: 'Deutsche Bank',
  iban: 'DE07 1007 0100 0142 6600 00',
  bic: 'DEUTDEBB101',
};

export const money = (v?: number | null, c?: string | null) => {
  const n = Number(v ?? 0);
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(n);
  } catch {
    return `${n.toFixed(2)} ${c || 'EUR'}`;
  }
};

export const dateDe = (d?: string | null) => {
  if (!d) return '—';
  const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('de-DE');
};

export const daysOverdue = (due?: string | null) => {
  if (!due) return 0;
  const dt = new Date(`${String(due).slice(0, 10)}T00:00:00`);
  if (isNaN(dt.getTime())) return 0;
  const diff = Math.floor((Date.now() - dt.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
};

/** Lädt die Alix-Briefvorlage einmalig als DataURL (PDF-Hintergrund). */
let bgPromise: Promise<string | null> | null = null;
export function loadLetterBackground(): Promise<string | null> {
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

export type LetterHeadData = {
  customerName: string;
  customerAddress?: string | null;
  shippingAddress?: string | null;
  customerNumber?: string | null;
  title: string;
  /** Zusatzzeile oben rechts, z. B. „Mahnstufe 2“ */
  reference?: string | null;
  /** Einleitungstext nach der Anrede */
  intro?: string | null;
};

export type LetterContext = {
  doc: ReturnType<typeof createPDF>;
  pageW: number;
  pageH: number;
  /** linker Textrand */
  m: number;
  /** rechter Textrand */
  right: number;
  /** Beginn der Fußzeile */
  footerTop: number;
  /** aktuelle Schreibposition */
  y: number;
  paintPage: () => void;
};

/** Legt ein Briefdokument an und zeichnet Hintergrund, Kopf-, Fußzeile und Anschrift. */
export async function createAlixLetter(head: LetterHeadData): Promise<LetterContext> {
  const doc = createPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const bg = await loadLetterBackground();

  const m = 28;
  const right = pageW - 15;
  const footerTop = pageH - 34;

  const paintPage = () => {
    if (bg) {
      try { doc.addImage(bg, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST'); } catch { /* ignore */ }
    }
    doc.setDrawColor(120);
    doc.setLineWidth(0.3);
    [87, 148.5, 192].forEach((yy) => doc.line(19, yy, 25, yy));

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

  // Anschriftenfeld
  const hasShipping = !!(head.shippingAddress && String(head.shippingAddress).trim());
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
  doc.text(head.customerName, m, 50);
  doc.setFont('Inter', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(70);
  const addrLines = doc.splitTextToSize(head.customerAddress || '', 80) as string[];
  if (addrLines.length) doc.text(addrLines, m, 55.5);

  if (hasShipping) {
    const sx = 110;
    doc.setFont('Inter', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text('Lieferanschrift', sx, 46.5);
    doc.setFont('Inter', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(head.customerName, sx, 50);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(70);
    const shipLines = doc.splitTextToSize(String(head.shippingAddress || ''), 75) as string[];
    if (shipLines.length) doc.text(shipLines, sx, 55.5);
  }

  // Titel
  y = 92;
  doc.setFont('Inter', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15);
  doc.text(head.title, m, y);
  doc.setFont('Inter', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')}`, right, y, { align: 'right' });
  if (head.customerNumber) doc.text(`Kundennr.: ${head.customerNumber}`, right, y - 5, { align: 'right' });
  if (head.reference) doc.text(String(head.reference), right, y - 10, { align: 'right' });
  y += 10;

  // Anrede + Einleitung
  doc.setFont('Inter', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40);
  doc.text(`Sehr geehrte Damen und Herren${head.customerName ? ` von ${head.customerName}` : ''},`, m, y);
  y += 6;
  if (head.intro) {
    const intro = doc.splitTextToSize(head.intro, right - m) as string[];
    doc.text(intro, m, y);
    y += intro.length * 5 + 6;
  }

  return { doc, pageW, pageH, m, right, footerTop, y, paintPage };
}

/** Grußformel am Ende des Briefes. */
export function letterClosing(ctx: LetterContext, signer = 'Alix Lasers Finance') {
  const { doc, m, footerTop } = ctx;
  ctx.y += 26;
  if (ctx.y > footerTop - 22) { doc.addPage(); ctx.paintPage(); ctx.y = 40; }
  doc.setFont('Inter', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40);
  doc.text('Mit freundlichen Grüßen', m, ctx.y);
  doc.setFont('Inter', 'bold');
  doc.setTextColor(20);
  doc.text(signer, m, ctx.y + 7);
}
