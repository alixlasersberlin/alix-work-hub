// Gemeinsamer PDF-Renderer für ALIX COLLECT (Schriftverkehr & digitale Akte)
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

export type Block =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'p'; text: string }
  | { type: 'spacer'; size?: number }
  | { type: 'table'; head: string[]; rows: string[][]; widths?: number[] };

// pdf-lib StandardFonts können nur WinAnsi kodieren – Sonderzeichen ersetzen
export function san(v: unknown): string {
  return String(v ?? '')
    .replace(/[–—]/g, '-')
    .replace(/[·•]/g, '-')
    .replace(/[""„]/g, '"')
    .replace(/['']/g, "'")
    .replace(/®/g, '(R)')
    .replace(/™/g, '(TM)')
    .replace(/…/g, '...')
    .replace(/\u00a0/g, ' ')
    // alles außerhalb Latin-1 entfernen
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');
}

export const eur = (n: unknown, cur = 'EUR') =>
  san(new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur || 'EUR' }).format(Number(n) || 0));

export const de = (d?: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '-');

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;

export async function renderPdf(opts: {
  title: string;
  subtitle?: string;
  blocks: Block[];
  footer?: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0.1, 0.1, 0.12);
  const grey = rgb(0.45, 0.45, 0.5);
  const gold = rgb(0.72, 0.58, 0.24);

  let page = doc.addPage(A4);
  let y = A4[1] - MARGIN;
  const width = A4[0] - MARGIN * 2;

  const footerText = san(opts.footer ?? 'Alix Lasers (R) - Forderungsmanagement');

  const drawFooter = (p: any) => {
    p.drawText(footerText, { x: MARGIN, y: 32, size: 7.5, font: helv, color: grey });
  };

  const newPage = () => {
    drawFooter(page);
    page = doc.addPage(A4);
    y = A4[1] - MARGIN;
  };

  const ensure = (need: number) => {
    if (y - need < 60) newPage();
  };

  const wrap = (text: string, font: any, size: number, maxWidth: number): string[] => {
    const out: string[] = [];
    for (const raw of san(text).split('\n')) {
      const words = raw.split(/\s+/);
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
          out.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      out.push(line);
    }
    return out;
  };

  // Kopf
  page.drawText('ALIX LASERS (R)', { x: MARGIN, y, size: 16, font: bold, color: black });
  y -= 14;
  page.drawText(san(opts.title), { x: MARGIN, y, size: 10, font: helv, color: gold });
  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + width, y }, thickness: 1, color: gold });
  y -= 20;
  if (opts.subtitle) {
    for (const l of wrap(opts.subtitle, helv, 9, width)) {
      page.drawText(l, { x: MARGIN, y, size: 9, font: helv, color: grey });
      y -= 12;
    }
    y -= 6;
  }

  for (const b of opts.blocks) {
    if (b.type === 'spacer') { y -= b.size ?? 12; continue; }

    if (b.type === 'h1' || b.type === 'h2') {
      const size = b.type === 'h1' ? 14 : 11;
      ensure(size + 14);
      y -= 6;
      page.drawText(san(b.text), { x: MARGIN, y, size, font: bold, color: black });
      y -= size + 6;
      continue;
    }

    if (b.type === 'p') {
      const lines = wrap(b.text, helv, 10, width);
      for (const l of lines) {
        ensure(14);
        page.drawText(l, { x: MARGIN, y, size: 10, font: helv, color: black });
        y -= 14;
      }
      y -= 4;
      continue;
    }

    if (b.type === 'table') {
      const cols = b.head.length;
      const widths = b.widths ?? Array(cols).fill(width / cols);
      ensure(24);
      let x = MARGIN;
      b.head.forEach((h, i) => {
        page.drawText(san(h), { x, y, size: 9, font: bold, color: black });
        x += widths[i];
      });
      y -= 4;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + width, y }, thickness: 0.5, color: grey });
      y -= 12;

      for (const row of b.rows) {
        ensure(16);
        x = MARGIN;
        row.forEach((cell, i) => {
          const maxW = widths[i] - 6;
          let txt = san(cell);
          while (txt && helv.widthOfTextAtSize(txt, 9) > maxW) txt = txt.slice(0, -2);
          page.drawText(txt, { x, y, size: 9, font: helv, color: black });
          x += widths[i];
        });
        y -= 13;
        page.drawLine({
          start: { x: MARGIN, y: y + 4 }, end: { x: MARGIN + width, y: y + 4 },
          thickness: 0.3, color: rgb(0.88, 0.88, 0.9),
        });
      }
      y -= 8;
    }
  }

  drawFooter(page);
  return await doc.save();
}
