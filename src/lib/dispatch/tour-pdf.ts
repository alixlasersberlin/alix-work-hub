import jsPDF from 'jspdf';
import tourBg from '@/assets/tour-vorlage.png.asset.json';
import { supabase } from '@/integrations/supabase/client';

/** Lädt die Alix-Vorlage einmalig als DataURL (für den PDF-Hintergrund). */
let bgPromise: Promise<string | null> | null = null;
export function loadTourBackground(): Promise<string | null> {
  if (!bgPromise) {
    bgPromise = fetch((tourBg as any).url)
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

const PAGE_W = 210;
const PAGE_H = 297;
const LEFT = 28;   // Platz für den blauen Vorlagen-Balken links
const RIGHT = 15;
const TOP = 34;
const BOTTOM = PAGE_H - 20;
const CONTENT_W = PAGE_W - LEFT - RIGHT;

type Line = { text: string; size: number; muted?: boolean; indent?: number; h: number; bold?: boolean };

function buildBlocks(entries: { tour: TourLike; stops: TourStopLike[] }[]): Line[][] {
  return entries.map(({ tour, stops }) => {
    const lines: Line[] = [];
    lines.push({
      text: `Tour ${tour.tour_number ?? '—'}${tour.title ? ` · ${tour.title}` : ''}`,
      size: 12, h: 7, bold: true,
    });
    const info = [
      `Datum ${d(tour.tour_date)}`,
      tour.planned_start_time ? `Start ${String(tour.planned_start_time).slice(0, 5)}` : null,
      tour.drivers?.full_name ? `Fahrer ${tour.drivers.full_name}` : null,
      tour.vehicles?.license_plate ?? null,
      tour.planned_distance_km != null ? `${tour.planned_distance_km} km` : null,
      tour.planned_drive_minutes ? `${tour.planned_drive_minutes} Min.` : null,
      tour.status ? String(tour.status) : null,
    ].filter(Boolean).join(' · ');
    lines.push({ text: info, size: 9, muted: true, h: 5.5 });

    const sorted = stops.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    lines.push({ text: `Stopps (${sorted.length})`, size: 9.5, h: 6, bold: true });
    if (!sorted.length) {
      lines.push({ text: 'Keine Stopps zugeordnet.', size: 9, muted: true, indent: 4, h: 5 });
    }
    sorted.forEach((s, i) => {
      const a = s.appointment ?? {};
      lines.push({
        text: `${s.position ?? i + 1}. ${a.order_number ?? 'Ohne Auftrag'} · ${a.company_name || a.customer_name || 'Ohne Kunde'}`,
        size: 9.5, h: 5,
      });
      lines.push({ text: stopAddress(a), size: 8.5, muted: true, indent: 4, h: 4.4 });
      const meta = [
        [a.device_name, a.serial_number].filter(Boolean).join(' · '),
        [a.contact_name, a.contact_phone].filter(Boolean).join(' · '),
        s.planned_arrival ? `Ankunft ${t(s.planned_arrival)}` : null,
        s.distance_from_prev_km != null ? `${s.distance_from_prev_km} km` : null,
      ].filter(Boolean).join(' · ');
      if (meta) lines.push({ text: meta, size: 8.5, muted: true, indent: 4, h: 4.4 });
      if (s.notes) lines.push({ text: String(s.notes), size: 8.5, muted: true, indent: 4, h: 4.4 });
    });
    lines.push({ text: '', size: 8, h: 5 });
    return lines;
  });
}

/**
 * A4 hochkant, Alix-Vorlage als Hintergrund auf JEDER Seite,
 * Inhalt wird bei Bedarf über mehrere Seiten verteilt.
 */
export async function buildToursPdf(entries: { tour: TourLike; stops: TourStopLike[] }[]) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const bg = await loadTourBackground();

  const title = entries.length === 1 ? 'Tourenplan' : `Tourenpläne (${entries.length})`;
  const subtitle = `Erstellt am ${new Date().toLocaleString('de-DE')} · AlixWork Dispatch Center`;

  const paintPage = (first: boolean) => {
    if (bg) {
      try { doc.addImage(bg, 'PNG', 0, 0, PAGE_W, PAGE_H, undefined, 'FAST'); } catch { /* ignore */ }
    }
    doc.setFontSize(first ? 18 : 12);
    doc.setTextColor(20);
    doc.text(title, LEFT, first ? 22 : 20);
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(subtitle, LEFT, first ? 28 : 25);
    doc.setTextColor(20);
  };

  paintPage(true);
  let y = TOP;

  const blocks = buildBlocks(entries);
  blocks.forEach((block) => {
    block.forEach((l) => {
      const wrapped = l.text
        ? (doc.setFontSize(l.size), doc.splitTextToSize(l.text, CONTENT_W - (l.indent ?? 0)) as string[])
        : [''];
      wrapped.forEach((part, idx) => {
        if (y + l.h > BOTTOM) {
          doc.addPage('a4', 'portrait');
          paintPage(false);
          y = TOP;
        }
        if (part) {
          doc.setFontSize(l.size);
          doc.setTextColor(l.muted ? 110 : 20);
          doc.text(part, LEFT + (l.indent ?? 0) + (idx > 0 ? 3 : 0), y);
        }
        y += l.h;
      });
    });
  });

  // Seitenzahlen
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(`Seite ${p} / ${pages}`, PAGE_W - RIGHT, PAGE_H - 10, { align: 'right' });
  }

  doc.setTextColor(20);
  return doc;
}

export async function downloadToursPdf(entries: { tour: TourLike; stops: TourStopLike[] }[]) {
  const doc = await buildToursPdf(entries);
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
