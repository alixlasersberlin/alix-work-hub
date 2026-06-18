import jsPDF from 'jspdf';
import { interRegular, interBold } from './pdf-fonts';

/**
 * Generates a document security ID in the format SEC-{YEAR}-{8 HEX}.
 * The ID uniquely identifies the printed document and is stamped on every page.
 */
export function generateSecurityId(): string {
  const year = new Date().getFullYear();
  let hex = '';
  try {
    const buf = new Uint8Array(4);
    (globalThis.crypto || (globalThis as any).msCrypto).getRandomValues(buf);
    hex = Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    hex = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  }
  return `SEC-${year}-${hex.toUpperCase()}`;
}

/**
 * Stamps the given security ID at the top-left corner of every page of the PDF.
 */
export function stampSecurityIdOnAllPages(doc: jsPDF, securityId: string) {
  const pageCount = (doc as any).getNumberOfPages
    ? (doc as any).getNumberOfPages()
    : (doc as any).internal.getNumberOfPages();
  const unit = (doc as any).internal?.scaleFactor ? doc.internal.pageSize : null;
  const isMm = ((doc as any).internal?.scaleFactor || 1) > 2; // mm => sf ~2.83, pt => sf 1
  // Position in current units
  const x = isMm ? 6 : 18;
  const y = isMm ? 5 : 14;
  const fontSize = isMm ? 7 : 8;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const prevSize = (doc as any).getFontSize?.() ?? 10;
    const prevColor = (doc as any).getTextColor?.() ?? '#000';
    try {
      doc.setFont('Inter', 'normal');
    } catch { /* font may not be loaded */ }
    doc.setFontSize(fontSize);
    doc.setTextColor(140);
    doc.text(securityId, x, y);
    // restore
    doc.setFontSize(prevSize);
    try { doc.setTextColor(prevColor as any); } catch { doc.setTextColor(0); }
  }
}

/**
 * Creates a jsPDF instance with embedded Inter font for proper German umlaut support.
 * Automatically stamps a unique security ID at the top-left of every page when the
 * document is saved or its output is requested.
 */
export function createPDF(options?: any): jsPDF {
  const doc = new jsPDF(options);

  doc.addFileToVFS('Inter-Regular.ttf', interRegular);
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
  doc.addFileToVFS('Inter-Bold.ttf', interBold);
  doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');
  doc.setFont('Inter', 'normal');

  const securityId = generateSecurityId();
  (doc as any).__alixSecurityId = securityId;

  const origOutput = doc.output.bind(doc);
  const origSave = doc.save.bind(doc);
  let stamped = false;
  const stampOnce = () => {
    if (stamped) return;
    stamped = true;
    const currentPage = (doc as any).internal.getCurrentPageInfo?.()?.pageNumber ?? 1;
    stampSecurityIdOnAllPages(doc, securityId);
    try { doc.setPage(currentPage); } catch { /* ignore */ }
  };
  (doc as any).output = ((...args: any[]) => {
    stampOnce();
    return (origOutput as any)(...args);
  }) as typeof doc.output;
  (doc as any).save = ((...args: any[]) => {
    stampOnce();
    return (origSave as any)(...args);
  }) as typeof doc.save;

  return doc;
}
