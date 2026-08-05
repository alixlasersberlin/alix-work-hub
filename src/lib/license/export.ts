import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(';'), ...rows.map((r) => r.map(esc).join(';'))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/** Excel-kompatibler Export (CSV mit Semikolon, von Excel direkt lesbar). */
export function downloadExcel(filename: string, headers: string[], rows: (string | number)[][]) {
  downloadCsv(filename.replace(/\.xlsx?$/, ''), headers, rows);
}

export function downloadPdf(
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number)[][],
  subtitle?: string,
) {
  const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text('ALIX LASERS LICENSING L.L.C-FZ · Dubai · alixlicence.com', 14, 22);
  if (subtitle) doc.text(subtitle, 14, 27);
  autoTable(doc, {
    head: [headers],
    body: rows.map((r) => r.map((c) => String(c ?? ''))),
    startY: subtitle ? 32 : 27,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [200, 162, 74] },
  });
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
