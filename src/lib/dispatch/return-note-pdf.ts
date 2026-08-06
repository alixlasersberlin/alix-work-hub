import jsPDF from 'jspdf';

export type ReturnNoteData = {
  return_number?: string | null;
  return_type?: string | null;
  status?: string | null;
  order_number?: string | null;
  customer_name?: string | null;
  company_name?: string | null;
  device_name?: string | null;
  serial_number?: string | null;
  replacement_device?: string | null;
  replacement_serial?: string | null;
  condition?: string | null;
  accessories?: string | null;
  reason?: string | null;
  target_location?: string | null;
  pickup_date?: string | null;
  notes?: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  rueckholung: 'Rückholung',
  geraetetausch: 'Gerätetausch',
  werkstatt: 'Werkstatt',
  ersatzgeraet_rueck: 'Ersatzgerät zurück',
};

function d(v?: string | null) {
  if (!v) return '—';
  const [y, m, day] = v.slice(0, 10).split('-');
  return day && m && y ? `${day}.${m}.${y}` : v;
}

export function buildReturnNotePdf(row: ReturnNoteData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 20;

  doc.setFontSize(18);
  doc.text('Retourenschein', 20, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Nr. ${row.return_number ?? '—'}  ·  Art: ${TYPE_LABEL[row.return_type ?? ''] ?? row.return_type ?? '—'}`, 20, y);
  y += 10;
  doc.setTextColor(0);

  const section = (title: string) => {
    doc.setFontSize(12);
    doc.text(title, 20, y);
    y += 2;
    doc.setDrawColor(200);
    doc.line(20, y, 190, y);
    y += 6;
    doc.setFontSize(10);
  };

  const line = (label: string, value?: string | null) => {
    doc.setTextColor(110);
    doc.text(label, 20, y);
    doc.setTextColor(0);
    doc.text(String(value ?? '—'), 65, y, { maxWidth: 125 });
    y += 6;
  };

  section('Kunde & Auftrag');
  line('Kunde', row.company_name || row.customer_name);
  line('Auftragsnummer', row.order_number);
  line('Abholdatum', d(row.pickup_date));
  line('Ziel', row.target_location);
  y += 4;

  section('Gerät');
  line('Gerät', row.device_name);
  line('Seriennummer', row.serial_number);
  if (row.replacement_device || row.replacement_serial) {
    line('Tauschgerät', row.replacement_device);
    line('Serie Tauschgerät', row.replacement_serial);
  }
  line('Zubehör', row.accessories);
  line('Zustand', row.condition);
  y += 4;

  section('Grund / Hinweise');
  const text = [row.reason, row.notes].filter(Boolean).join('\n') || '—';
  const wrapped = doc.splitTextToSize(text, 170);
  doc.text(wrapped, 20, y);
  y += wrapped.length * 5 + 8;

  section('Zustandsprüfung Wareneingang');
  ['Gerät vollständig', 'Zubehör vollständig', 'Transportschäden', 'Funktionstest'].forEach(l => {
    doc.rect(20, y - 3.5, 4, 4);
    doc.text(l, 27, y);
    doc.setDrawColor(200);
    doc.line(90, y, 190, y);
    y += 8;
  });

  y += 12;
  doc.setDrawColor(120);
  doc.line(20, y, 90, y);
  doc.line(110, y, 190, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text('Übergabe Kunde (Datum, Unterschrift)', 20, y);
  doc.text('Annahme Alix (Datum, Unterschrift)', 110, y);

  return doc;
}

export function downloadReturnNotePdf(row: ReturnNoteData) {
  buildReturnNotePdf(row).save(`Retourenschein_${row.return_number ?? 'neu'}.pdf`);
}
