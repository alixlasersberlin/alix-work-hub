import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

const HIDDEN_KEYS = new Set([
  'id', 'media_package_id', 'created_at', 'updated_at', 'customer_id', 'order_id',
]);

const SECTIONS: Array<{ table: string; title: string; multi?: boolean }> = [
  { table: 'media_package_contact_data', title: 'Kontaktdaten' },
  { table: 'media_package_studio_data', title: 'Studio-Daten' },
  { table: 'media_package_branding', title: 'Branding & Corporate Design' },
  { table: 'media_package_opening_hours', title: 'Öffnungszeiten', multi: true },
  { table: 'media_package_team_members', title: 'Team', multi: true },
  { table: 'media_package_services', title: 'Leistungen', multi: true },
  { table: 'media_package_treatments', title: 'Behandlungen', multi: true },
  { table: 'media_package_devices', title: 'Geräte', multi: true },
  { table: 'media_package_prices', title: 'Preise', multi: true },
  { table: 'media_package_files', title: 'Dateien / Uploads', multi: true },
];

const LABELS: Record<string, string> = {
  first_name: 'Vorname', last_name: 'Nachname', email: 'E-Mail', phone: 'Telefon',
  mobile: 'Mobil', website: 'Website', street: 'Straße', house_number: 'Nr.',
  zip: 'PLZ', city: 'Ort', country: 'Land', company_name: 'Firma', studio_name: 'Studio',
  legal_form: 'Rechtsform', tax_id: 'USt-IdNr.', description: 'Beschreibung',
  role: 'Rolle', name: 'Name', title: 'Titel', price: 'Preis', currency: 'Währung',
  duration_minutes: 'Dauer (Min.)', category: 'Kategorie', notes: 'Notizen',
  day_of_week: 'Wochentag', open_time: 'Öffnet', close_time: 'Schließt',
  is_closed: 'Geschlossen', file_name: 'Dateiname', file_size: 'Größe',
  mime_type: 'Typ', url: 'URL', logo_url: 'Logo', primary_color: 'Primärfarbe',
  secondary_color: 'Sekundärfarbe', font_family: 'Schriftart',
};

const label = (k: string) => LABELS[k] || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const fmt = (v: any): string => {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nein';
  if (Array.isArray(v)) return v.length ? v.map(fmt).join(', ') : '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

export async function exportMediaPackagePdf(mediaPackageId: string) {
  // Fetch main media package
  const { data: mp } = await supabase
    .from('media_packages')
    .select('*, orders(order_number), customers(company_name, first_name, last_name, email, phone)')
    .eq('id', mediaPackageId)
    .maybeSingle();

  const results = await Promise.all(
    SECTIONS.map(async (s) => {
      const { data } = await (supabase as any)
        .from(s.table)
        .select('*')
        .eq('media_package_id', mediaPackageId);
      return { ...s, rows: (data as any[]) || [] };
    })
  );

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 48;

  // Header
  doc.setFillColor(15, 15, 15);
  doc.rect(0, 0, pageW, 70, 'F');
  doc.setTextColor(212, 175, 55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Mediapaket – Kundendaten', 40, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  const orderNo = (mp as any)?.orders?.order_number || '—';
  const cust = (mp as any)?.customers;
  const custName = cust?.company_name || [cust?.first_name, cust?.last_name].filter(Boolean).join(' ') || '—';
  doc.text(`Auftrag: ${orderNo}   |   Kunde: ${custName}   |   Erzeugt: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 40, 52);

  doc.setTextColor(0, 0, 0);
  y = 96;

  // Overview
  autoTable(doc, {
    startY: y,
    head: [['Feld', 'Wert']],
    body: [
      ['Studio', (mp as any)?.studio_name || '—'],
      ['Status', (mp as any)?.status || '—'],
      ['Fortschritt', `${(mp as any)?.progress_percent ?? 0} %`],
      ['Frist', (mp as any)?.due_date ? format(new Date((mp as any).due_date), 'dd.MM.yyyy') : '—'],
      ['Eingereicht am', (mp as any)?.submitted_at ? format(new Date((mp as any).submitted_at), 'dd.MM.yyyy HH:mm') : '—'],
      ['Kunde E-Mail', cust?.email || '—'],
      ['Kunde Telefon', cust?.phone || '—'],
    ],
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [30, 30, 30], textColor: [212, 175, 55] },
    columnStyles: { 0: { cellWidth: 140, fontStyle: 'bold' } },
    margin: { left: 40, right: 40 },
  });
  y = (doc as any).lastAutoTable.finalY + 20;

  for (const section of results) {
    if (!section.rows.length) continue;
    if (y > 740) { doc.addPage(); y = 48; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(212, 175, 55);
    doc.text(section.title, 40, y);
    doc.setDrawColor(212, 175, 55);
    doc.line(40, y + 4, pageW - 40, y + 4);
    y += 14;
    doc.setTextColor(0, 0, 0);

    if (section.multi) {
      // Table: use keys of first row
      const keys = Object.keys(section.rows[0]).filter(k => !HIDDEN_KEYS.has(k));
      autoTable(doc, {
        startY: y,
        head: [keys.map(label)],
        body: section.rows.map(r => keys.map(k => fmt(r[k]))),
        styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
        headStyles: { fillColor: [30, 30, 30], textColor: [212, 175, 55] },
        margin: { left: 40, right: 40 },
      });
      y = (doc as any).lastAutoTable.finalY + 18;
    } else {
      const row = section.rows[0];
      const body = Object.entries(row)
        .filter(([k]) => !HIDDEN_KEYS.has(k))
        .map(([k, v]) => [label(k), fmt(v)]);
      autoTable(doc, {
        startY: y,
        head: [['Feld', 'Wert']],
        body,
        styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
        headStyles: { fillColor: [30, 30, 30], textColor: [212, 175, 55] },
        columnStyles: { 0: { cellWidth: 160, fontStyle: 'bold' } },
        margin: { left: 40, right: 40 },
      });
      y = (doc as any).lastAutoTable.finalY + 18;
    }
  }

  // Footer page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Seite ${i} / ${pages}`, pageW - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
    doc.text('Alix Work · Mediapaket-Export', 40, doc.internal.pageSize.getHeight() - 20);
  }

  const filename = `mediapaket_${orderNo}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}
