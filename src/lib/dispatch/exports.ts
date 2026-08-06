import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

/** Gemeinsame Exportfunktionen für das ALIX Dispatch Center (Phase 6). */

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCsv(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(';'), ...rows.map(r => cols.map(c => esc(r[c])).join(';'))].join('\n');
  download(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
}

export function exportXlsx(rows: Record<string, any>[], filename: string, sheet = 'Daten') {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function header(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  if (subtitle) doc.text(subtitle, 14, 22);
  doc.text(`Erstellt am ${format(new Date(), 'dd.MM.yyyy HH:mm')} · AlixWork Dispatch Center`, 14, subtitle ? 27 : 22);
  doc.setTextColor(0);
  return subtitle ? 32 : 27;
}

const addr = (a: any) =>
  [a?.delivery_street, [a?.delivery_zip, a?.delivery_city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

/** Fahrerunterlagen: Tourkopf, Stoppliste mit Kontakt, Gerät und Zeitfenster. */
export function tourPaperworkPdf(tour: any, stops: any[]) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const y = header(
    doc,
    `Fahrerunterlagen ${tour?.tour_number ?? ''}`,
    `${tour?.tour_date ? format(new Date(tour.tour_date), 'dd.MM.yyyy') : ''} · Fahrer: ${tour?.drivers?.full_name ?? '—'} · Fahrzeug: ${tour?.vehicles?.license_plate ?? '—'} · ${tour?.planned_distance_km ?? 0} km · ${tour?.planned_drive_minutes ?? 0} Min.`,
  );
  autoTable(doc, {
    startY: y,
    head: [['#', 'Kunde', 'Adresse', 'Telefon', 'Auftrag', 'Gerät / Serie', 'Ankunft', 'Notiz']],
    body: stops.map((s: any) => {
      const a = s.delivery_appointments ?? {};
      return [
        s.position ?? '',
        a.company_name || a.customer_name || '',
        addr(a),
        a.contact_phone || '',
        a.order_number || '',
        [a.device_name, a.serial_number].filter(Boolean).join(' / '),
        s.planned_arrival ? format(new Date(s.planned_arrival), 'HH:mm') : '',
        s.notes || '',
      ];
    }),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 30, 30] },
  });
  doc.save(`Fahrerunterlagen_${tour?.tour_number ?? 'Tour'}.pdf`);
}

/** Beladungsliste in umgekehrter Auslieferreihenfolge. */
export function loadingListPdf(tour: any, items: any[]) {
  const doc = new jsPDF();
  const y = header(
    doc,
    `Beladungsliste ${tour?.tour_number ?? ''}`,
    `${tour?.tour_date ? format(new Date(tour.tour_date), 'dd.MM.yyyy') : ''} · Fahrzeug: ${tour?.vehicles?.license_plate ?? '—'}`,
  );
  autoTable(doc, {
    startY: y,
    head: [['#', 'Bezeichnung', 'Seriennummer', 'Menge', 'kg', 'Status', 'Geladen ☐']],
    body: items.map((i: any) => [
      i.position ?? '',
      i.item_name || i.description || '',
      i.serial_number || '',
      i.quantity ?? 1,
      i.weight_kg ?? '',
      i.status || '',
      '',
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 30, 30] },
  });
  const total = items.reduce((s, i: any) => s + Number(i.weight_kg || 0), 0);
  const endY = (doc as any).lastAutoTable?.finalY ?? y;
  doc.setFontSize(10);
  doc.text(`Gesamtgewicht: ${total.toFixed(1)} kg${tour?.vehicles?.max_payload_kg ? ` / Zuladung ${tour.vehicles.max_payload_kg} kg` : ''}`, 14, endY + 8);
  doc.text('Beladen durch: ______________________     Datum/Unterschrift: ______________________', 14, endY + 18);
  doc.save(`Beladungsliste_${tour?.tour_number ?? 'Tour'}.pdf`);
}

/** Tages- bzw. Wochenplan über mehrere Touren. */
export function planPdf(title: string, subtitle: string, tours: any[]) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const y = header(doc, title, subtitle);
  autoTable(doc, {
    startY: y,
    head: [['Datum', 'Tour', 'Fahrer', 'Fahrzeug', 'Start', 'Stopps', 'km', 'Fahrzeit', 'Auslastung', 'Status']],
    body: tours.map((t: any) => [
      t.tour_date ? format(new Date(t.tour_date), 'dd.MM.yyyy') : '',
      t.tour_number || t.title || '',
      t.drivers?.full_name || '',
      t.vehicles?.license_plate || '',
      t.planned_start_time?.slice(0, 5) || '',
      t.stop_count ?? '',
      t.planned_distance_km ?? '',
      t.planned_drive_minutes ? `${t.planned_drive_minutes} Min.` : '',
      t.utilization_pct != null ? `${t.utilization_pct} %` : '',
      t.status || '',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 30, 30] },
  });
  doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
}

/** Km- und Kostenübersicht. */
export function costPdf(rows: any[], from: string, to: string, total: number) {
  const doc = new jsPDF();
  const y = header(doc, 'Kosten- und Kilometerübersicht', `Zeitraum ${from} – ${to}`);
  autoTable(doc, {
    startY: y,
    head: [['Datum', 'Tour', 'Kostenart', 'Kostenstelle', 'Menge', 'Betrag']],
    body: rows.map((r: any) => [
      r.datum, r.tour, r.kostenart, r.kostenstelle, r.menge, `${Number(r.betrag).toFixed(2)} €`,
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 30, 30] },
  });
  const endY = (doc as any).lastAutoTable?.finalY ?? y;
  doc.setFontSize(11);
  doc.text(`Gesamt: ${total.toFixed(2)} €`, 14, endY + 10);
  doc.save(`Kostenuebersicht_${from}_${to}.pdf`);
}
