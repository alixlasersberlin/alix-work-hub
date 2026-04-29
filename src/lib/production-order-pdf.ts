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
  sonder:       ['Interne Nummer',           'Internal Number'],
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

  // Kopfdaten – zweispaltiges Label/Wert-Layout mit großzügiger Label-Spalte
  drawText(bi('details'), 20, y, 'bold'); y += 6;
  const rows: Array<[string, string]> = [
    [bi('modellname'),   data.modellname || '—'],
    [bi('farbe'),        data.farbe],
    [bi('power'),        data.power_handstueck],
    [bi('bearbeiter'),   data.bearbeiter],
    [bi('liefertermin'), format(new Date(data.liefertermin), 'dd.MM.yyyy')],
    [bi('seriennummer'), data.seriennummer || '—'],
  ];
  const labelX = 20;
  const valueX = 95; // mehr Platz für lange bilinguale Labels
  rows.forEach(([k, v]) => {
    drawText(`${k}:`, labelX, y, 'bold');
    drawText(v, valueX, y);
    y += 5.5;
  });
  y += 5;

  if (data.sonderwuensche) {
    drawText(`${bi('sonder')}:`, 20, y, 'bold'); y += 5;
    setFontFor(data.sonderwuensche);
    const lines = doc.splitTextToSize(data.sonderwuensche, pageWidth - 40);
    doc.text(lines, 20, y); y += lines.length * 5 + 3;
  }

  // Positionen – klar getrennte Spalten: Pos | Artikel | Beschreibung | Menge
  if (data.items.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    drawText(bi('positions'), 20, y, 'bold'); y += 6;
    doc.setFontSize(9);

    // Spalten-Geometrie
    const colPosX   = 22;   // Pos-Nr
    const colArtX   = 32;   // Artikelname (Start)
    const colDescX  = 95;   // Beschreibung (Start)
    const colQtyX   = pageWidth - 22; // Menge rechtsbündig
    const artWidth  = colDescX - colArtX - 3;       // ~60 mm
    const descWidth = colQtyX - colDescX - 14;      // ~79 mm

    // Header-Zeile
    doc.setFillColor(240, 240, 240);
    doc.rect(20, y - 4, pageWidth - 40, 6, 'F');
    drawText(bi('pos'),          colPosX,  y, 'bold');
    drawText(bi('artikel'),      colArtX,  y, 'bold');
    drawText(bi('beschreibung'), colDescX, y, 'bold');
    drawText(bi('menge'),        colQtyX,  y, 'bold', { align: 'right' });
    y += 5;

    data.items.forEach((it, idx) => {
      const name = it.item_name || '—';
      const desc = it.description || '—';
      setFontFor(name);
      const nameLines = doc.splitTextToSize(name, artWidth);
      setFontFor(desc);
      const descLines = doc.splitTextToSize(desc, descWidth);
      const rowH = Math.max(nameLines.length, descLines.length) * 4.5 + 2;

      if (y + rowH > 275) { doc.addPage(); y = 20; }

      drawText(String(idx + 1), colPosX, y);
      setFontFor(name);
      doc.text(nameLines, colArtX, y);
      setFontFor(desc);
      doc.text(descLines, colDescX, y);
      drawText(`${it.quantity ?? ''} ${it.unit ?? ''}`.trim(), colQtyX, y, 'normal', { align: 'right' });

      y += rowH;
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
