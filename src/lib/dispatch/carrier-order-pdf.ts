import jsPDF from 'jspdf';

export type CarrierOrderData = {
  id: string;
  status?: string | null;
  assigned_date?: string | null;
  agreed_price?: number | null;
  currency?: string | null;
  tracking_number?: string | null;
  notes?: string | null;
  carrier?: {
    name?: string | null;
    contact_name?: string | null;
    street?: string | null;
    zip?: string | null;
    city?: string | null;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  appointment?: {
    order_number?: string | null;
    customer_name?: string | null;
    company_name?: string | null;
    device_name?: string | null;
    serial_number?: string | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
    delivery_street?: string | null;
    delivery_zip?: string | null;
    delivery_city?: string | null;
    delivery_country?: string | null;
    planned_date?: string | null;
  } | null;
};

const PICKUP = [
  'Alix Lasers GmbH',
  'Lager / Warenausgang',
  'Bitte Abholung telefonisch avisieren',
];

function d(v?: string | null) {
  if (!v) return '—';
  const [y, m, day] = v.slice(0, 10).split('-');
  return day && m && y ? `${day}.${m}.${y}` : v;
}

export function buildCarrierOrderPdf(row: CarrierOrderData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const a = row.appointment ?? {};
  const c = row.carrier ?? {};
  let y = 20;

  doc.setFontSize(18);
  doc.text('Frachtauftrag / Speditionsversand', 20, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Auftrag: ${a.order_number ?? '—'}   ·   Erstellt: ${d(new Date().toISOString())}`, 20, y);
  doc.setTextColor(0);
  y += 10;

  const block = (title: string, lines: (string | null | undefined)[], x: number, top: number) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, x, top);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let ly = top + 6;
    lines.filter(Boolean).forEach((l) => {
      doc.text(String(l), x, ly);
      ly += 5;
    });
    return ly;
  };

  const leftEnd = block('Spedition', [
    c.name, c.contact_name, c.street,
    [c.zip, c.city].filter(Boolean).join(' '),
    c.country, c.phone, c.email,
  ], 20, y);

  const rightEnd = block('Abholadresse', PICKUP, 110, y);
  y = Math.max(leftEnd, rightEnd) + 6;

  y = block('Lieferadresse (Kunde)', [
    a.company_name || a.customer_name,
    a.company_name && a.customer_name ? a.customer_name : null,
    a.delivery_street,
    [a.delivery_zip, a.delivery_city].filter(Boolean).join(' '),
    a.delivery_country,
    a.contact_name ? `Ansprechpartner: ${a.contact_name}` : null,
    a.contact_phone ? `Telefon: ${a.contact_phone}` : null,
  ], 20, y) + 6;

  y = block('Sendung', [
    `Gerät: ${a.device_name ?? '—'}`,
    `Seriennummer: ${a.serial_number ?? '—'}`,
    `Abholdatum: ${d(row.assigned_date)}`,
    `Wunsch-Liefertermin: ${d(a.planned_date)}`,
    `Sendungsnummer: ${row.tracking_number ?? '—'}`,
    row.agreed_price != null ? `Vereinbarter Preis: ${Number(row.agreed_price).toFixed(2)} ${row.currency ?? 'EUR'}` : null,
  ], 20, y) + 6;

  if (row.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Hinweise', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 6;
    doc.splitTextToSize(row.notes, 170).forEach((l: string) => {
      doc.text(l, 20, y);
      y += 5;
    });
    y += 4;
  }

  doc.setDrawColor(200);
  doc.line(20, y, 190, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Empfindliches medizinisches Gerät – bitte stoßfrei transportieren und vor Nässe schützen.', 20, y);
  y += 12;
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.text('Datum / Unterschrift Fahrer:', 20, y);
  doc.line(75, y + 1, 130, y + 1);

  return doc;
}

export function downloadCarrierOrderPdf(row: CarrierOrderData) {
  const doc = buildCarrierOrderPdf(row);
  doc.save(`Frachtauftrag_${row.appointment?.order_number ?? row.id.slice(0, 8)}.pdf`);
}
