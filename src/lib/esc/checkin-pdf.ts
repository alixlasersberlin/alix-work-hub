import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { EscAppointment } from './types';

export interface CheckinPdfInput {
  appointment: EscAppointment;
  signerName: string;
  signerRole: string;
  signatureDataUrl: string;
  checkinAt: string;
  checkoutAt?: string;
  notes?: string;
  geo?: { lat?: number; lng?: number };
}

export function generateCheckinPdf(input: CheckinPdfInput): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = M;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Termin-Protokoll', M, y);
  y += 8;
  doc.setDrawColor(200);
  doc.line(M, y, W - M, y);
  y += 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(input.appointment.title, M, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const row = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, M, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value || '—', M + 130, y);
    y += 14;
  };

  const a = input.appointment;
  row('Datum:', format(new Date(a.startAt), 'EEEE, dd. MMMM yyyy', { locale: de }));
  row('Uhrzeit:', `${format(new Date(a.startAt), 'HH:mm')} – ${format(new Date(a.endAt), 'HH:mm')}`);
  row('Standort:', a.location || a.address || '—');
  row('Kunde:', a.customerName || '—');
  row('Kontakt:', a.customerContact || a.customerEmail || a.customerPhone || '—');
  y += 6;

  doc.setDrawColor(220);
  doc.line(M, y, W - M, y);
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Check-in', M, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  row('Name:', input.signerName);
  row('Rolle:', input.signerRole);
  row('Check-in:', format(new Date(input.checkinAt), 'dd.MM.yyyy HH:mm:ss'));
  if (input.checkoutAt) row('Check-out:', format(new Date(input.checkoutAt), 'dd.MM.yyyy HH:mm:ss'));
  if (input.geo?.lat && input.geo?.lng) row('Geo:', `${input.geo.lat.toFixed(5)}, ${input.geo.lng.toFixed(5)}`);
  if (input.notes) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Notizen:', M, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(input.notes, W - 2 * M);
    doc.text(lines, M, y);
    y += lines.length * 12;
  }

  y += 12;
  doc.setDrawColor(220);
  doc.line(M, y, W - M, y);
  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.text('Unterschrift', M, y);
  y += 8;

  try {
    doc.addImage(input.signatureDataUrl, 'PNG', M, y, 220, 90);
  } catch { /* ignore */ }
  y += 100;
  doc.setDrawColor(180);
  doc.line(M, y, M + 220, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${input.signerName} • ${format(new Date(input.checkinAt), 'dd.MM.yyyy HH:mm')}`, M, y);

  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text('Erstellt mit ESC – Enterprise Scheduling Center', M, doc.internal.pageSize.getHeight() - 24);

  return doc.output('blob');
}
