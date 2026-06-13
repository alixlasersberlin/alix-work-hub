/**
 * Repair Work Order PDF (Arbeitsauftrag)
 * – jsPDF basiert, mit Alix Lasers Logo oben rechts
 * – Ausführlicher Arbeitsbericht mit allen relevanten Feldern
 * – Liefert Blob, kann gedruckt, heruntergeladen oder per Mail versendet werden
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoAsset from '@/assets/alix-lasers-logo-gold.png.asset.json';

type RenderInput = {
  repair: any;
  parts?: any[];
};

const LOGO_URL = logoAsset.url;

let cachedLogo: string | null = null;
async function getLogoDataUrl(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const res = await fetch(LOGO_URL);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    cachedLogo = dataUrl;
    return dataUrl;
  } catch {
    return null;
  }
}

function fmt(v: any): string {
  if (v == null || v === '') return '–';
  return String(v);
}

function fmtBool(v: any): string {
  if (v === true) return 'Ja';
  if (v === false) return 'Nein';
  return '–';
}

async function buildPdf({ repair, parts = [] }: RenderInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = M;

  // === Header mit Logo oben rechts ===
  const logo = await getLogoDataUrl();
  if (logo) {
    try {
      // Höhe ~ 36pt, Verhältnis ~ 5:1 → Breite ~180pt
      doc.addImage(logo, 'PNG', W - M - 160, M - 10, 160, 32);
    } catch { /* ignore */ }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text('Arbeitsauftrag', M, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 95, 105);
  doc.text(`Reparatur-Nr.: ${fmt(repair.repair_number)}`, M, y + 26);
  doc.text(`Datum: ${new Date().toLocaleString('de-DE')}`, M, y + 40);
  if (repair.order_number) doc.text(`Zoho-Auftrag: ${fmt(repair.order_number)}`, M, y + 54);

  y = M + 80;

  doc.setDrawColor(200, 170, 90);
  doc.setLineWidth(1.2);
  doc.line(M, y, W - M, y);
  y += 14;

  // === Kunde ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text('Kunde', M, y);
  y += 4;
  autoTable(doc, {
    startY: y + 4,
    head: [],
    body: [
      ['Kunde / Firma', fmt(repair.customer_name)],
      ['Firma', fmt(repair.customer_company)],
      ['Ansprechpartner', fmt(repair.customer_contact)],
      ['E-Mail', fmt(repair.customer_email)],
      ['Telefon', fmt(repair.customer_phone)],
      ['Adresse', [repair.address_street, [repair.address_zip, repair.address_city].filter(Boolean).join(' '), repair.address_country].filter(Boolean).join(', ') || '–'],
      ['Priorität', fmt(repair.priority)],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 130, textColor: [80, 80, 80] } },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  // === Gerät ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Gerät', M, y);
  autoTable(doc, {
    startY: y + 6,
    head: [],
    body: [
      ['Gerätetyp', fmt(repair.device_type)],
      ['Kategorie', fmt(repair.device_category)],
      ['Marke', fmt(repair.device_brand)],
      ['Modell', fmt(repair.device_model)],
      ['Seriennummer', fmt(repair.device_serial_number)],
      ['Kaufdatum', fmt(repair.purchase_date)],
      ['Zubehör', fmt(repair.accessories)],
      ['Sichtbare Schäden', fmt(repair.visible_damages)],
      ['Schaltet ein?', fmtBool(repair.powers_on)],
      ['Fehler permanent?', fmtBool(repair.error_permanent)],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 130, textColor: [80, 80, 80] } },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  // === Fehlerbeschreibung ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Fehlerbeschreibung Kunde', M, y);
  y += 6;
  const issue = repair.customer_error_description || repair.issue_description || '–';
  autoTable(doc, {
    startY: y,
    body: [[issue]],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 6, minCellHeight: 50, valign: 'top' },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  // === Diagnose (Werkstatt) ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Diagnose / Ursache', M, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    body: [[fmt(repair.diagnosis)]],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 6, minCellHeight: 60, valign: 'top' },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  // === Arbeitsbericht (durchgeführte Arbeiten) ===
  if (y > 680) { doc.addPage(); y = M; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Arbeitsbericht / Durchgeführte Arbeiten', M, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    body: [[fmt(repair.work_report || repair.internal_notes)]],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 6, minCellHeight: 120, valign: 'top' },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  // === Ersatzteile ===
  if (y > 680) { doc.addPage(); y = M; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Ersatzteile', M, y);
  autoTable(doc, {
    startY: y + 6,
    head: [['Bezeichnung', 'SKU', 'Menge', 'Lieferant', 'Status']],
    body: parts.length
      ? parts.map((p) => [fmt(p.item_name || p.part_name), fmt(p.sku), fmt(p.quantity), fmt(p.supplier_name), fmt(p.order_status || p.status)])
      : [['–', '–', '–', '–', '–']],
    theme: 'striped',
    headStyles: { fillColor: [235, 220, 180], textColor: [60, 50, 20] },
    styles: { fontSize: 9, cellPadding: 4 },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  // === Kosten ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Kosten', M, y);
  autoTable(doc, {
    startY: y + 6,
    body: [
      ['Kostenvoranschlag', `${fmt(repair.estimated_cost)} ${repair.currency || 'EUR'}`],
      ['Tatsächliche Kosten', `${fmt(repair.actual_cost)} ${repair.currency || 'EUR'}`],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 180, textColor: [80, 80, 80] } },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 20;

  // === Unterschriften ===
  if (y > 720) { doc.addPage(); y = M; }
  doc.setDrawColor(60);
  doc.setLineWidth(0.5);
  const colW = (W - M * 2 - 30) / 2;
  doc.line(M, y + 30, M + colW, y + 30);
  doc.line(M + colW + 30, y + 30, W - M, y + 30);
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text('Unterschrift Techniker / Datum', M, y + 44);
  doc.text('Endkontrolle / Freigabe', M + colW + 30, y + 44);

  // === Footer ===
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(`Alix Lasers · Arbeitsauftrag · generiert ${new Date().toLocaleString('de-DE')}`, M, pageH - 20);

  return doc;
}

export async function generateRepairWorkOrderPdfBlob(input: RenderInput): Promise<Blob> {
  const doc = await buildPdf(input);
  return doc.output('blob');
}

export async function renderRepairWorkOrderPdf(input: RenderInput, action: 'print' | 'download') {
  const doc = await buildPdf(input);
  const fileName = `Arbeitsauftrag-${input.repair.repair_number || 'reparatur'}.pdf`;
  if (action === 'print') {
    const url = doc.output('bloburl');
    const w = window.open(String(url), '_blank');
    if (w) setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 600);
  } else {
    doc.save(fileName);
  }
}

export async function workOrderPdfBase64(input: RenderInput): Promise<{ base64: string; fileName: string }> {
  const doc = await buildPdf(input);
  // jsPDF datauristring → strip prefix
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',', 2)[1] || '';
  const fileName = `Arbeitsauftrag-${input.repair.repair_number || 'reparatur'}.pdf`;
  return { base64, fileName };
}
