import jsPDF from 'jspdf';

export type TourStopLike = {
  position?: number | null;
  planned_arrival?: string | null;
  stop_status?: string | null;
  distance_from_prev_km?: number | null;
  notes?: string | null;
  appointment?: {
    order_number?: string | null;
    customer_name?: string | null;
    company_name?: string | null;
    device_name?: string | null;
    serial_number?: string | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    delivery_street?: string | null;
    delivery_zip?: string | null;
    delivery_city?: string | null;
    planned_date?: string | null;
  } | null;
};

export type TourLike = {
  id: string;
  tour_number?: string | null;
  tour_date?: string | null;
  title?: string | null;
  status?: string | null;
  planned_distance_km?: number | null;
  planned_drive_minutes?: number | null;
  planned_start_time?: string | null;
  drivers?: { full_name?: string | null } | null;
  vehicles?: { license_plate?: string | null } | null;
};

function d(v?: string | null) {
  if (!v) return '—';
  const [y, m, day] = v.slice(0, 10).split('-');
  return day && m && y ? `${day}.${m}.${y}` : v;
}

function t(v?: string | null) {
  if (!v) return '—';
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return String(v).slice(0, 5);
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function stopAddress(a: TourStopLike['appointment']) {
  if (!a) return '—';
  return [a.delivery_street, [a.delivery_zip, a.delivery_city].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ') || '—';
}

function header(doc: jsPDF, title: string, subtitle: string) {
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text(title, 20, 20);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(subtitle, 20, 27);
  doc.setTextColor(20);
}

function renderTour(doc: jsPDF, tour: TourLike, stops: TourStopLike[], startY: number) {
  let y = startY;
  const line = (label: string, value: string) => {
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(label, 20, y);
    doc.setTextColor(20);
    doc.text(value, 60, y);
    y += 5.5;
  };

  doc.setFontSize(13);
  doc.text(`Tour ${tour.tour_number ?? '—'}${tour.title ? ` · ${tour.title}` : ''}`, 20, y);
  y += 7;

  line('Datum', d(tour.tour_date));
  line('Start', tour.planned_start_time ? String(tour.planned_start_time).slice(0, 5) + ' Uhr' : '—');
  line('Fahrer', tour.drivers?.full_name ?? '—');
  line('Fahrzeug', tour.vehicles?.license_plate ?? '—');
  line('Strecke', tour.planned_distance_km != null ? `${tour.planned_distance_km} km` : '—');
  line('Fahrzeit', tour.planned_drive_minutes ? `${tour.planned_drive_minutes} Min.` : '—');
  line('Status', String(tour.status ?? '—'));
  y += 3;

  doc.setFontSize(11);
  doc.text(`Aufträge / Stopps (${stops.length})`, 20, y);
  y += 6;

  if (!stops.length) {
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text('Keine Stopps zugeordnet.', 20, y);
    doc.setTextColor(20);
    return y + 8;
  }

  stops
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .forEach((s, i) => {
      if (y > 265) { doc.addPage(); y = 20; }
      const a = s.appointment ?? {};
      doc.setFontSize(10);
      doc.text(
        `${s.position ?? i + 1}. ${a.order_number ?? 'Ohne Auftrag'} · ${a.company_name || a.customer_name || 'Ohne Kunde'}`,
        20, y,
      );
      y += 5;
      doc.setTextColor(110);
      doc.setFontSize(9);
      doc.text(stopAddress(a), 25, y);
      y += 4.5;
      const meta = [
        [a.device_name, a.serial_number].filter(Boolean).join(' · '),
        [a.contact_name, a.contact_phone].filter(Boolean).join(' · '),
        s.planned_arrival ? `Ankunft ${t(s.planned_arrival)}` : null,
        s.distance_from_prev_km != null ? `${s.distance_from_prev_km} km` : null,
      ].filter(Boolean).join(' · ');
      if (meta) { doc.text(meta, 25, y); y += 4.5; }
      if (s.notes) { doc.text(String(s.notes).slice(0, 120), 25, y); y += 4.5; }
      doc.setTextColor(20);
      y += 2;
    });

  return y + 6;
}

export function buildToursPdf(entries: { tour: TourLike; stops: TourStopLike[] }[]) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  header(
    doc,
    entries.length === 1 ? 'Tourenplan' : `Tourenpläne (${entries.length})`,
    `Erstellt am ${new Date().toLocaleString('de-DE')} · AlixWork Dispatch Center`,
  );
  let y = 38;
  entries.forEach((e, idx) => {
    if (idx > 0) { doc.addPage(); y = 20; }
    y = renderTour(doc, e.tour, e.stops, y);
  });
  return doc;
}

export function downloadToursPdf(entries: { tour: TourLike; stops: TourStopLike[] }[]) {
  const doc = buildToursPdf(entries);
  const name = entries.length === 1
    ? `Tour_${entries[0].tour.tour_number ?? entries[0].tour.id}.pdf`
    : `Touren_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(name);
}

/* ---------- Speditionsversand ---------- */

export function downloadShipmentsPdf(rows: any[]) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  header(
    doc,
    `Speditionsversand (${rows.length})`,
    `Erstellt am ${new Date().toLocaleString('de-DE')} · AlixWork Dispatch Center`,
  );

  let y = 40;
  const cols: [string, number][] = [
    ['Auftrag', 20], ['Kunde', 55], ['Gerät', 110], ['Spedition', 160],
    ['Abholung', 205], ['Sendungsnr.', 232], ['Status', 265],
  ];
  doc.setFontSize(9);
  doc.setTextColor(110);
  cols.forEach(([label, x]) => doc.text(label, x, y));
  doc.setTextColor(20);
  y += 5;
  doc.setDrawColor(200);
  doc.line(20, y - 3, 285, y - 3);

  rows.forEach((r) => {
    if (y > 195) { doc.addPage(); y = 20; }
    const a = r.appointment ?? {};
    const p = r.route_plan ?? {};
    const cells = [
      a.order_number ?? p?.order?.order_number ?? '—',
      a.company_name || a.customer_name || p?.order?.customer?.company_name || p?.contact_name || '—',
      [a.device_name || p.device_model, a.serial_number || p.device_serial_number].filter(Boolean).join(' · ') || '—',
      r.carrier?.name ?? '—',
      d(r.assigned_date),
      r.tracking_number ?? '—',
      r.status ?? '—',
    ];
    doc.setFontSize(9);
    cells.forEach((c, i) => doc.text(String(c).slice(0, 34), cols[i][1], y));
    y += 6;
  });

  doc.save(`Speditionsversand_${new Date().toISOString().slice(0, 10)}.pdf`);
}
