/**
 * Reparaturbericht – echte PDF-Erzeugung via jsPDF.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import alixLogo from '@/assets/alix-logo-gold.png';

type ReportDoc = {
  repair: any;
  parts: any[];
  history?: any[];
  technician?: string;
};

function build({ repair, parts, history = [], technician }: ReportDoc): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  const today = new Date().toLocaleDateString('de-DE');
  const device = [repair?.device_brand, repair?.device_model].filter(Boolean).join(' ') || repair?.device_category || '';

  // Logo top-right
  try {
    const logoW = 90, logoH = 28;
    doc.addImage(alixLogo, 'PNG', W - M - logoW, 28, logoW, logoH);
  } catch { /* ignore */ }

  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(15, 23, 42);
  doc.text('Reparaturbericht', M, 50);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(40);
  doc.text(`Reparaturnr.: ${repair.repair_number ?? ''}`, M, 68);
  doc.text(`Datum: ${today}`, M, 82);
  doc.text(`Status: ${repair.repair_status ?? ''}`, M, 96);

  let y = 120;
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4 },
    head: [['Kunde & Gerät', '']],
    body: [
      ['Kunde', repair.customer_name ?? '–'],
      ['E-Mail', repair.customer_email ?? '–'],
      ['Telefon', repair.customer_phone ?? '–'],
      ['Auftrag (Zoho)', repair.order_number ?? '–'],
      ['Marke / Modell', device || '–'],
      ['Seriennummer', repair.device_serial_number ?? '–'],
      ['Kaufdatum', repair.purchase_date ?? '–'],
      ['Techniker', technician ?? '–'],
    ],
    headStyles: { fillColor: [217, 178, 60], textColor: 20 },
    columnStyles: { 0: { cellWidth: 130, fontStyle: 'bold' } },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  const section = (title: string, text: string) => {
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(15, 23, 42);
    doc.text(title, M, y); y += 12;
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(40);
    const lines = doc.splitTextToSize(text || '–', W - 2 * M);
    doc.text(lines, M, y);
    y += lines.length * 11 + 10;
    if (y > 760) { doc.addPage(); y = 60; }
  };

  section('Fehlerbild / Kundenbeschreibung', repair.issue_description || repair.customer_error_description || '–');
  section('Diagnose / Ursache', repair.diagnosis || '–');
  section('Durchgeführte Arbeiten', repair.internal_notes || '–');

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4 },
    head: [['Bezeichnung', 'SKU', 'Menge', 'Status']],
    body: parts.length
      ? parts.map((p: any) => [p.part_name || p.name || '', p.sku || '', String(p.quantity ?? 1), p.status || ''])
      : [[{ content: 'Keine Ersatzteile verbaut', colSpan: 4, styles: { halign: 'center', textColor: 140 } }]],
    headStyles: { fillColor: [217, 178, 60], textColor: 20 },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  if (history.length) {
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      head: [['Datum', 'von', 'nach', 'Hinweis']],
      body: history.slice(0, 20).map((h: any) => [
        new Date(h.created_at).toLocaleString('de-DE'),
        h.old_status || '–',
        h.new_status || '',
        h.change_note || '',
      ]),
      headStyles: { fillColor: [217, 178, 60], textColor: 20 },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 30;
  } else {
    y += 20;
  }

  if (y > 720) { doc.addPage(); y = 700; }
  doc.setDrawColor(0); doc.setLineWidth(0.5);
  doc.line(M, y, M + 200, y);
  doc.line(W - M - 200, y, W - M, y);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(80);
  doc.text('Techniker', M, y + 12);
  doc.text('Endkontrolle / Freigabe', W - M - 200, y + 12);

  return doc;
}

export function printRepairReport(d: ReportDoc) {
  const doc = build(d);
  const url = doc.output('bloburl');
  window.open(String(url), '_blank');
}

export function repairReportPdfBlob(d: ReportDoc): Blob {
  return build(d).output('blob');
}

// Backwards-compat alias (kept name, now returns PDF Blob)
export function repairReportHtmlBlob(d: ReportDoc): Blob {
  return repairReportPdfBlob(d);
}
