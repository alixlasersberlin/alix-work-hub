import jsPDF from 'jspdf';

export interface PoPdfItem {
  position_no?: number | null;
  part_number?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  price?: number | null;
}

export interface PoPdfData {
  po_number?: string | null;
  order_date?: string | null;
  expected_date?: string | null;
  currency?: string | null;
  notes?: string | null;
  supplier?: {
    name?: string | null;
    supplier_number?: string | null;
    contact_name?: string | null;
    street?: string | null;
    zip?: string | null;
    city?: string | null;
    country?: string | null;
    email?: string | null;
  } | null;
  items: PoPdfItem[];
}

const SENDER = [
  'Alix Lasers GmbH',
  'Einkauf / Beschaffung',
  'einkauf@alix-lasers.com',
];

function d(v?: string | null) {
  if (!v) return '—';
  const [y, m, day] = String(v).slice(0, 10).split('-');
  return day && m && y ? `${day}.${m}.${y}` : String(v);
}

function money(n: number, cur: string) {
  return `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)} ${cur}`;
}

export function buildPurchaseOrderPdf(po: PoPdfData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const cur = po.currency || 'EUR';
  const s = po.supplier || {};
  let y = 20;

  doc.setFontSize(18);
  doc.text('Bestellung', 20, y);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(SENDER, 190, y - 4, { align: 'right' });
  doc.setTextColor(0);
  y += 12;

  doc.setFontSize(11);
  doc.text('Lieferant', 20, y);
  doc.setFontSize(10);
  y += 6;
  [
    s.name || '—',
    s.contact_name || '',
    s.street || '',
    [s.zip, s.city].filter(Boolean).join(' '),
    s.country || '',
  ].filter(Boolean).forEach(line => { doc.text(String(line), 20, y); y += 5; });

  let ry = 32;
  doc.setFontSize(10);
  [
    ['Bestell-Nr.', po.po_number || '—'],
    ['Bestelldatum', d(po.order_date)],
    ['Voraussichtl.\nLiefertermin', d(po.expected_date)],
    ['Lieferantennr.', s.supplier_number || '—'],
  ].forEach(([k, v]) => {
    const kLines = String(k).split('\n');
    doc.setTextColor(110);
    kLines.forEach((line, i) => doc.text(line, 130, ry + i * 4.2));
    doc.setTextColor(0); doc.text(String(v), 190, ry + (kLines.length - 1) * 4.2, { align: 'right' });
    ry += 5 + (kLines.length - 1) * 4.2;
  });

  y = Math.max(y, ry) + 8;

  doc.setDrawColor(200);
  doc.line(20, y, 190, y);
  y += 5;
  doc.setTextColor(110);
  doc.setFontSize(9);
  doc.text('Pos.', 20, y);
  doc.text('Teilenummer', 32, y);
  doc.text('Bezeichnung', 68, y);
  doc.text('Menge', 140, y, { align: 'right' });
  doc.text('Preis', 165, y, { align: 'right' });
  doc.text('Summe', 190, y, { align: 'right' });
  doc.setTextColor(0);
  y += 3;
  doc.line(20, y, 190, y);
  y += 6;

  let total = 0;
  doc.setFontSize(9);
  po.items.forEach((it, i) => {
    if (y > 260) { doc.addPage(); y = 20; }
    const qty = Number(it.quantity || 0);
    const price = Number(it.price || 0);
    const sum = qty * price;
    total += sum;
    doc.text(String(it.position_no ?? i + 1), 20, y);
    doc.text(String(it.part_number || '—'), 32, y);
    doc.text(doc.splitTextToSize(String(it.description || '—'), 68)[0] ?? '—', 68, y);
    doc.text(`${qty} ${it.unit || 'Stk'}`, 140, y, { align: 'right' });
    doc.text(money(price, cur), 165, y, { align: 'right' });
    doc.text(money(sum, cur), 190, y, { align: 'right' });
    y += 6;
  });

  doc.line(20, y, 190, y);
  y += 6;
  doc.setFontSize(11);
  doc.text('Gesamtsumme (netto)', 140, y, { align: 'right' });
  doc.text(money(total, cur), 190, y, { align: 'right' });
  y += 12;

  doc.setFontSize(9);
  if (po.notes) {
    doc.setTextColor(60);
    doc.text(doc.splitTextToSize(`Hinweise: ${po.notes}`, 170), 20, y);
    y += 10;
  }
  doc.setTextColor(110);
  doc.text(
    doc.splitTextToSize(
      'Bitte bestätigen Sie Preise, Mengen und Liefertermin. Lieferungen bitte mit Lieferschein, Chargen-/Seriennummern und ggf. Materialzertifikat versehen. Es gelten unsere Qualitätsanforderungen gemäß ISO 13485.',
      170,
    ),
    20,
    y,
  );

  return doc;
}

export function purchaseOrderFileName(po: PoPdfData) {
  return `Bestellung_${(po.po_number || 'PO').replace(/[^\w-]/g, '_')}.pdf`;
}
