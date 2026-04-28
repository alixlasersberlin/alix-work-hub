import { createPDF } from './pdf-utils';
import { ensureCJKFont } from './pdf-cjk-font';
import { format } from 'date-fns';
import alixLogo from '@/assets/alix-lasers-logo.png';

const COMPANY_ADDRESS = [
  'Alix Lasers GmbH',
  'Buchsbaumweg 53',
  '12357 Berlin',
  'Deutschland',
];

let logoDataUrlPromise: Promise<string | null> | null = null;
async function loadLogoDataUrl(): Promise<string | null> {
  if (logoDataUrlPromise) return logoDataUrlPromise;
  logoDataUrlPromise = (async () => {
    try {
      const res = await fetch(alixLogo);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('Logo konnte nicht geladen werden', e);
      return null;
    }
  })();
  return logoDataUrlPromise;
}

export interface ProductionOrderPdfData {
  order_number: string;
  modellname?: string | null;
  farbe: string;
  power_handstueck: string;
  bearbeiter: string;
  liefertermin: string;
  sonderwuensche?: string | null;
  seriennummer?: string | null;
  anmerkungen?: string | null;
  supplier: { name: string; address?: string | null; email: string; phone?: string | null };
  items: Array<{ item_name?: string | null; description?: string | null; sku?: string | null; quantity?: number | null; unit?: string | null }>;
}

// Zweisprachige Labels: Deutsch / English
const L = {
  title:        ['Bestellung an Produktion', 'Production Order'],
  orderNo:      ['Bestellnummer',            'Order No.'],
  date:         ['Datum',                    'Date'],
  recipient:    ['Empfänger',                'Recipient'],
  email:        ['E-Mail',                   'Email'],
  phone:        ['Telefon',                  'Phone'],
  details:      ['Bestelldetails',           'Order Details'],
  modellname:   ['Modellname',               'Model Name'],
  farbe:        ['Farbe',                    'Color'],
  power:        ['Power Handstück',          'Power Handpiece'],
  bearbeiter:   ['Bearbeiter',               'Processor'],
  liefertermin: ['Liefertermin',             'Delivery Date'],
  seriennummer: ['Seriennummer',             'Serial Number'],
  sonder:       ['Sonderwünsche',            'Special Requests'],
  positions:    ['Positionen',               'Items'],
  pos:          ['Pos',                      'No.'],
  artikel:      ['Artikel',                  'Article'],
  beschreibung: ['Beschreibung',             'Description'],
  menge:        ['Menge',                    'Quantity'],
  anmerk:       ['Anmerkungen',              'Notes'],
};

export type PdfLang = 'bilingual' | 'en';

export async function generateProductionOrderPdf(
  data: ProductionOrderPdfData,
  lang: PdfLang = 'bilingual'
): Promise<{ blob: Blob; filename: string }> {
  const bi = (key: keyof typeof L) =>
    lang === 'en' ? L[key][1] : `${L[key][0]} / ${L[key][1]}`;
  const doc = createPDF({ unit: 'mm', format: 'a4' });
  const cjkOk = await ensureCJKFont(doc);

  // Helfer: setzt CJK-Font, wenn der Text Nicht-Latein-Zeichen enthält,
  // sonst Inter (für saubere deutsche Umlaute & Bold-Variante).
  const hasCJK = (s: string) => /[\u3000-\u9fff\uff00-\uffef]/.test(s);
  const setFontFor = (text: string, weight: 'normal' | 'bold' = 'normal') => {
    if (cjkOk && hasCJK(text)) {
      doc.setFont('NotoSC', 'normal');
    } else {
      doc.setFont('Inter', weight);
    }
  };
  const drawText = (
    text: string,
    x: number,
    y: number,
    weight: 'normal' | 'bold' = 'normal',
    opts?: any
  ) => {
    setFontFor(text, weight);
    doc.text(text, x, y, opts);
  };

  const pageWidth = 210;
  let y = 20;

  // Logo + Absenderadresse rechts oben
  const logoData = await loadLogoDataUrl();
  const logoW = 32;
  const logoH = 12;
  const rightX = pageWidth - 20;
  let rightY = y;
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', rightX - logoW, rightY - 4, logoW, logoH);
      rightY += logoH;
    } catch (e) {
      console.warn('Logo Embed fehlgeschlagen', e);
    }
  }
  doc.setFontSize(8);
  COMPANY_ADDRESS.forEach((line) => {
    drawText(line, rightX, rightY, 'normal', { align: 'right' });
    rightY += 3.5;
  });

  // Titel links oben
  doc.setFontSize(16);
  if (lang === 'en') {
    drawText(L.title[1], 20, y, 'bold');
  } else {
    drawText(L.title[0], 20, y, 'bold');
    doc.setFontSize(12);
    drawText(L.title[1], 20, y + 6, 'bold');
  }

  // Bestellnr / Datum unter Header (nach Logo+Adresse-Block)
  y = Math.max(y + 18, rightY + 4);
  doc.setFontSize(10);
  drawText(`${bi('orderNo')}: ${data.order_number}`, rightX, y, 'normal', { align: 'right' });
  drawText(`${bi('date')}: ${format(new Date(), 'dd.MM.yyyy')}`, rightX, y + 5, 'normal', { align: 'right' });
  y += 12;

  // Empfänger
  doc.setFontSize(11);
  drawText(`${bi('recipient')}:`, 20, y, 'bold'); y += 6;
  doc.setFontSize(10);
  drawText(data.supplier.name, 20, y); y += 5;
  if (data.supplier.address) {
    data.supplier.address.split('\n').forEach(line => { drawText(line, 20, y); y += 5; });
  }
  drawText(`${bi('email')}: ${data.supplier.email}`, 20, y); y += 5;
  if (data.supplier.phone) { drawText(`${bi('phone')}: ${data.supplier.phone}`, 20, y); y += 5; }
  y += 5;

  // Kopfdaten
  drawText(bi('details'), 20, y, 'bold'); y += 6;
  const rows: Array<[string, string]> = [
    [bi('modellname'),   data.modellname || '—'],
    [bi('farbe'),        data.farbe],
    [bi('power'),        data.power_handstueck],
    [bi('bearbeiter'),   data.bearbeiter],
    [bi('liefertermin'), format(new Date(data.liefertermin), 'dd.MM.yyyy')],
    [bi('seriennummer'), data.seriennummer || '—'],
  ];
  rows.forEach(([k, v]) => {
    drawText(`${k}:`, 20, y, 'bold');
    drawText(v, 80, y);
    y += 5;
  });
  y += 5;

  if (data.sonderwuensche) {
    drawText(`${bi('sonder')}:`, 20, y, 'bold'); y += 5;
    setFontFor(data.sonderwuensche);
    const lines = doc.splitTextToSize(data.sonderwuensche, pageWidth - 40);
    doc.text(lines, 20, y); y += lines.length * 5 + 3;
  }

  // Positionen
  if (data.items.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    drawText(bi('positions'), 20, y, 'bold'); y += 6;
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(20, y - 4, pageWidth - 40, 6, 'F');
    drawText(bi('pos'),          22, y, 'bold');
    drawText(bi('artikel'),      35, y, 'bold');
    drawText(bi('beschreibung'), 95, y, 'bold');
    drawText(bi('menge'),        pageWidth - 22, y, 'bold', { align: 'right' });
    y += 4;

    data.items.forEach((it, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const name = it.item_name || '—';
      const desc = it.description || '—';
      drawText(String(idx + 1), 22, y);
      setFontFor(name);
      doc.text(doc.splitTextToSize(name, 55), 35, y);
      setFontFor(desc);
      doc.text(doc.splitTextToSize(desc, 70), 95, y);
      drawText(`${it.quantity ?? ''} ${it.unit ?? ''}`.trim(), pageWidth - 22, y, 'normal', { align: 'right' });
      y += 6;
    });
    y += 4;
    doc.setFontSize(10);
  }

  // Anmerkungen
  if (data.anmerkungen) {
    if (y > 240) { doc.addPage(); y = 20; }
    drawText(`${bi('anmerk')}:`, 20, y, 'bold'); y += 5;
    setFontFor(data.anmerkungen);
    const lines = doc.splitTextToSize(data.anmerkungen, pageWidth - 40);
    doc.text(lines, 20, y); y += lines.length * 5;
  }

  const blob = doc.output('blob');
  const suffix = lang === 'en' ? '_EN' : '';
  const filename = `Bestellung_${data.order_number}_${format(new Date(), 'yyyyMMdd')}${suffix}.pdf`;
  return { blob, filename };
}
