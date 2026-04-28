import { createPDF } from './pdf-utils';
import { format } from 'date-fns';

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

export function generateProductionOrderPdf(data: ProductionOrderPdfData): { blob: Blob; filename: string } {
  const doc = createPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  let y = 20;

  // Header
  doc.setFont('Inter', 'bold');
  doc.setFontSize(18);
  doc.text('Bestellung an Produktion', 20, y);

  doc.setFontSize(10);
  doc.setFont('Inter', 'normal');
  doc.text(`Bestellnummer: ${data.order_number}`, pageWidth - 20, y, { align: 'right' });
  y += 6;
  doc.text(`Datum: ${format(new Date(), 'dd.MM.yyyy')}`, pageWidth - 20, y, { align: 'right' });
  y += 10;

  // Empfänger
  doc.setFont('Inter', 'bold');
  doc.setFontSize(11);
  doc.text('Empfänger:', 20, y);
  y += 5;
  doc.setFont('Inter', 'normal');
  doc.setFontSize(10);
  doc.text(data.supplier.name, 20, y); y += 5;
  if (data.supplier.address) {
    data.supplier.address.split('\n').forEach(line => { doc.text(line, 20, y); y += 5; });
  }
  doc.text(`E-Mail: ${data.supplier.email}`, 20, y); y += 5;
  if (data.supplier.phone) { doc.text(`Telefon: ${data.supplier.phone}`, 20, y); y += 5; }
  y += 5;

  // Kopfdaten
  doc.setFont('Inter', 'bold');
  doc.text('Bestelldetails', 20, y); y += 6;
  doc.setFont('Inter', 'normal');
  const rows: [string, string][] = [
    ['Modellname', data.modellname || '—'],
    ['Farbe', data.farbe],
    ['Power Handstück', data.power_handstueck],
    ['Bearbeiter', data.bearbeiter],
    ['Liefertermin', format(new Date(data.liefertermin), 'dd.MM.yyyy')],
    ['Seriennummer', data.seriennummer || '—'],
  ];
  rows.forEach(([k, v]) => {
    doc.setFont('Inter', 'bold'); doc.text(`${k}:`, 20, y);
    doc.setFont('Inter', 'normal'); doc.text(v, 65, y);
    y += 5;
  });
  y += 5;

  if (data.sonderwuensche) {
    doc.setFont('Inter', 'bold'); doc.text('Sonderwünsche:', 20, y); y += 5;
    doc.setFont('Inter', 'normal');
    const lines = doc.splitTextToSize(data.sonderwuensche, pageWidth - 40);
    doc.text(lines, 20, y); y += lines.length * 5 + 3;
  }

  // Positionen
  if (data.items.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFont('Inter', 'bold');
    doc.text('Positionen', 20, y); y += 6;
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(20, y - 4, pageWidth - 40, 6, 'F');
    doc.text('Pos', 22, y);
    doc.text('Artikel', 35, y);
    doc.text('Beschreibung', 95, y);
    doc.text('Menge', pageWidth - 30, y, { align: 'right' });
    y += 4;
    doc.setFont('Inter', 'normal');
    data.items.forEach((it, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(String(idx + 1), 22, y);
      doc.text(doc.splitTextToSize(it.item_name || '—', 55), 35, y);
      doc.text(doc.splitTextToSize(it.description || '—', 70), 95, y);
      doc.text(`${it.quantity ?? ''} ${it.unit ?? ''}`.trim(), pageWidth - 22, y, { align: 'right' });
      y += 6;
    });
    y += 4;
    doc.setFontSize(10);
  }

  // Anmerkungen
  if (data.anmerkungen) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont('Inter', 'bold'); doc.text('Anmerkungen:', 20, y); y += 5;
    doc.setFont('Inter', 'normal');
    const lines = doc.splitTextToSize(data.anmerkungen, pageWidth - 40);
    doc.text(lines, 20, y); y += lines.length * 5;
  }

  const blob = doc.output('blob');
  const filename = `Bestellung_${data.order_number}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  return { blob, filename };
}
