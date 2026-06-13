// Builds the final signed Alix Sign PDF (offer + signature page) client-side.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import alixLogo from '@/assets/alix-logo-gold.png';

type Snapshot = {
  offerNumber: string;
  offerDate?: string;
  validUntil?: string;
  notes?: string;
  customer?: any;
  lines: any[];
  totals: { net: number; tax: number; gross: number };
  payment: { type: string; price: number; down: number; term: number };
};

type Sig = {
  signerName: string;
  signerEmail: string;
  signerLocation: string;
  signedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  signatureDataUrl: string;
  acceptedOffer: boolean;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  acceptedElectronicSignature: boolean;
  acceptedCreditCheck: boolean | null;
  requestId: string;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);

export function buildSignedPdfBase64(snap: Snapshot, sig: Sig): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const LEFT = 18;
  const RIGHT = PAGE_W - 18;
  const CONTENT_W = RIGHT - LEFT;
  const logoW = 42;
  const logoH = 11;

  // ---------- Page 1+: Offer content ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20, 60, 110);
  doc.text('Angebot', LEFT, 25);
  try {
    doc.addImage(alixLogo, 'PNG', RIGHT - logoW, 14, logoW, logoH);
  } catch {
    // ignore logo rendering errors
  }
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nr. ${snap.offerNumber}`, LEFT, 32);
  if (snap.offerDate) doc.text(`Datum: ${new Date(snap.offerDate).toLocaleDateString('de-DE')}`, LEFT, 38);

  const c = snap.customer || {};
  let y = 50;
  doc.setFont('helvetica', 'bold');
  doc.text('Kunde', LEFT, y); y += 5;
  doc.setFont('helvetica', 'normal');
  if (c.company_name) { doc.text(String(c.company_name), LEFT, y); y += 5; }
  if (c.contact_name) { doc.text(String(c.contact_name), LEFT, y); y += 5; }
  if (c.email) { doc.text(String(c.email), LEFT, y); y += 5; }
  if (c.phone) { doc.text(String(c.phone), LEFT, y); y += 5; }

  const body = (snap.lines || []).map((l, i) => [
    String(i + 1),
    `${l.name || ''}${l.description ? '\n' + l.description : ''}`,
    String(l.quantity ?? 1),
    fmtMoney(Number(l.rate || 0)),
    `${Number(l.tax_percentage || 0)}%`,
    fmtMoney(Number(l.rate || 0) * Number(l.quantity || 1)),
  ]);

  autoTable(doc, {
    startY: y + 6,
    head: [['#', 'Position', 'Menge', 'Preis', 'MwSt', 'Summe']],
    body,
    theme: 'grid',
    headStyles: { fillColor: [183, 217, 255], textColor: [20, 60, 110], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { halign: 'right', cellWidth: 16 }, 3: { halign: 'right', cellWidth: 25 }, 4: { halign: 'right', cellWidth: 16 }, 5: { halign: 'right', cellWidth: 25 } },
    margin: { left: LEFT, right: PAGE_W - RIGHT },
  });

  let fy = (doc as any).lastAutoTable.finalY + 8;
  if (fy > PAGE_H - 60) { doc.addPage(); fy = 25; }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60, 60, 60);
  doc.text('Netto:', 130, fy); doc.text(fmtMoney(snap.totals.net), RIGHT, fy, { align: 'right' });
  doc.text('MwSt:', 130, fy + 5); doc.text(fmtMoney(snap.totals.tax), RIGHT, fy + 5, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(20, 60, 110);
  doc.text('Gesamt:', 130, fy + 13); doc.text(fmtMoney(snap.totals.gross), RIGHT, fy + 13, { align: 'right' });

  let py = fy + 24;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text(`Zahlungsart: ${snap.payment.type}`, LEFT, py);

  // ---------- Signature page ----------
  doc.addPage();
  let sy = 25;
  try {
    doc.addImage(alixLogo, 'PNG', RIGHT - logoW, 14, logoW, logoH);
  } catch {
    // ignore logo rendering errors
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(20, 60, 110);
  doc.text('Alix Sign — Annahmeerklärung', LEFT, sy); sy += 10;
  doc.setDrawColor(20, 60, 110); doc.setLineWidth(0.5); doc.line(LEFT, sy, RIGHT, sy); sy += 8;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
  const intro = `Hiermit nimmt der/die Unterzeichnende das Angebot ${snap.offerNumber} der Alix Lasers GmbH verbindlich an. Die Annahme erfolgt elektronisch über Alix Sign.`;
  doc.splitTextToSize(intro, CONTENT_W).forEach((ln: string) => { doc.text(ln, LEFT, sy); sy += 5; });
  sy += 4;

  const row = (k: string, v: string) => {
    doc.setFont('helvetica', 'bold'); doc.text(k, LEFT, sy);
    doc.setFont('helvetica', 'normal'); doc.text(v, LEFT + 55, sy);
    sy += 5;
  };
  row('Unterzeichner:', sig.signerName);
  row('E-Mail:', sig.signerEmail);
  row('Ort:', sig.signerLocation || '—');
  row('Datum / Uhrzeit:', sig.signedAt.toLocaleString('de-DE'));
  row('IP-Adresse:', sig.ipAddress || '—');
  row('Gerät / User-Agent:', (sig.userAgent || '—').slice(0, 80));
  row('Angebotsnummer:', snap.offerNumber);
  row('Gesamtbetrag:', fmtMoney(snap.totals.gross));
  row('Zahlungsart:', snap.payment.type);
  row('Signatur-Request:', sig.requestId);
  sy += 4;

  doc.setFont('helvetica', 'bold'); doc.text('Zustimmungen:', LEFT, sy); sy += 6;
  doc.setFont('helvetica', 'normal');
  const chk = (v: boolean | null, label: string) => {
    const mark = v === true ? '[x]' : v === false ? '[ ]' : '[—]';
    doc.text(`${mark}  ${label}`, LEFT, sy); sy += 5;
  };
  chk(sig.acceptedOffer, 'Ich habe das Angebot gelesen und nehme es verbindlich an.');
  chk(sig.acceptedTerms, 'Ich akzeptiere die AGB und Vertragsbedingungen.');
  chk(sig.acceptedPrivacy, 'Ich habe die Datenschutzhinweise zur Kenntnis genommen.');
  chk(sig.acceptedElectronicSignature, 'Ich bin mit der elektronischen Signatur über Alix Sign einverstanden.');
  if (sig.acceptedCreditCheck !== null) {
    chk(sig.acceptedCreditCheck, 'Ich bin mit einer Bonitäts- und Identitätsprüfung einverstanden.');
  }

  sy += 6;
  doc.setFont('helvetica', 'bold'); doc.text('Unterschrift:', LEFT, sy); sy += 4;
  try {
    doc.addImage(sig.signatureDataUrl, 'PNG', LEFT, sy, 70, 30);
  } catch { /* ignore */ }
  sy += 34;
  doc.setDrawColor(180, 180, 180); doc.line(LEFT, sy, LEFT + 70, sy); sy += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(sig.signerName, LEFT, sy);

  // Footer note
  doc.setFontSize(8); doc.setTextColor(110, 110, 110);
  const foot = 'Dieses Dokument wurde elektronisch über Alix Sign unterzeichnet. Die Annahme des Angebots gilt als verbindliche Vertragserklärung.';
  doc.splitTextToSize(foot, CONTENT_W).forEach((ln: string, i: number) => {
    doc.text(ln, LEFT, PAGE_H - 12 + i * 4);
  });

  // Page numbers
  const total = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text(`Angebot ${snap.offerNumber}  ·  Seite ${i} von ${total}  ·  Alix Sign`, RIGHT, PAGE_H - 4, { align: 'right' });
  }

  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',')[1] || '';
  return base64;
}
