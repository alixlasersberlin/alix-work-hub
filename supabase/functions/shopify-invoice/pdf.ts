import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { paymentText } from '../_shared/shopify-invoice-rules.ts';

// Matches the regular Alix finance letter and invoice table; amounts are snapshot values.
export async function createInvoicePdf(prepared: any): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const response = await fetch('https://alixwork.de/__l5e/assets-v1/bd6a7a37-f311-4e47-8d59-177f546680e8/kontoauszug-vorlage.png', { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Rechnungsvorlage nicht verfügbar.');
  const bg = await doc.embedPng(await response.arrayBuffer());
  const snapshot = prepared.snapshot;
  const money = (n: number) => Number(n).toLocaleString('de-DE', { style: 'currency', currency: snapshot.currency });
  const date = (value: unknown) => {
    const str = String(value ?? '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(str) ? `${str.slice(8)}.${str.slice(5, 7)}.${str.slice(0, 4)}` : str;
  };
  const clean = (v: unknown) => String(v ?? '').replace(/[\r\t]/g, ' ').replace(/[^\x20-\xFF€\n]/g, '?');
  const mm = (n: number) => n * 72 / 25.4;
  const left = mm(28), right = mm(195), width = right - left;
  const ink = rgb(0.10, 0.10, 0.10), muted = rgb(0.43, 0.43, 0.43);
  let page = doc.addPage([595.28, 841.89]);
  let y = 40;
  const text = (value: unknown, x: number, top: number, size = 9, strong = false, alignRight = false, color = ink) => {
    const font = strong ? bold : normal;
    const str = clean(value).replace(/\n/g, ' ');
    page.drawText(str, { x: alignRight ? x - font.widthOfTextAtSize(str, size) : x, y: 841.89 - mm(top), size, font, color });
  };
  const lines = (value: unknown, maxWidth: number, size = 9, strong = false) => {
    const font = strong ? bold : normal;
    const result: string[] = [];
    for (const paragraph of clean(value).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > maxWidth && line) { result.push(line); line = word; } else line = next;
        while (font.widthOfTextAtSize(line, size) > maxWidth) {
          let cut = line.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > maxWidth) cut--;
          result.push(line.slice(0, cut)); line = line.slice(cut);
        }
      }
      result.push(line);
    }
    return result;
  };
  const rule = (top: number) => page.drawLine({ start: { x: left, y: 841.89 - mm(top) }, end: { x: right, y: 841.89 - mm(top) }, thickness: 0.5, color: rgb(0.84, 0.84, 0.84) });
  const paint = () => {
    page.drawImage(bg, { x: 0, y: 0, width: 595.28, height: 841.89 });
    for (const top of [87, 148.5, 192]) page.drawLine({ start: { x: mm(19), y: 841.89 - mm(top) }, end: { x: mm(25), y: 841.89 - mm(top) }, thickness: 0.6, color: muted });
    rule(263);
    text('Alix Lasers GmbH', left, 268, 7.5, true);
    text('Zeppelin Straße 3 · 12529 Berlin-Schönefeld', left, 273, 7, false, false, muted);
    text('Tel. +49 30 577 127 45 · Fax +49 30 577 127 46', left, 278, 7, false, false, muted);
    text('service@alix-lasers.com · USt-IdNr. DE321691012', left, 283, 7, false, false, muted);
    text('Bankverbindung', right, 268, 7.5, true, true);
    text('Deutsche Bank', right, 273, 7, false, true, muted);
    text('IBAN DE07 1007 0100 0142 6600 00', right, 278, 7, false, true, muted);
    text('BIC DEUTDEBB101', right, 283, 7, false, true, muted);
    text(`Rechnung ${prepared.number} · Seite ${doc.getPageCount()}`, right, 289, 7, false, true, muted);
  };
  const newPage = () => { page = doc.addPage([595.28, 841.89]); paint(); y = 40; };
  const paragraph = (value: unknown, size = 9, strong = false) => {
    for (const line of lines(value, width, size, strong)) {
      if (y > 249) newPage();
      text(line, left, y, size, strong); y += 5;
    }
  };
  paint();
  text('Alix Lasers GmbH', right, 26, 10, true, true);
  ['Zeppelin Straße 3', '12529 Berlin-Schönefeld', 'Tel. +49 30 577 127 45', 'service@alix-lasers.com'].forEach((line, i) => text(line, right, 30.5 + i * 4.5, 8.5, false, true, muted));
  text('Alix Lasers GmbH · Zeppelin Straße 3 · 12529 Berlin-Schönefeld', left, 42, 6.5, false, false, muted);
  y = 50;
  const a = prepared.invoice.billing_address ?? {};
  // Retain the stored address, including company/country fields, without rewriting customer data.
  const address = [a.company, a.address1 || a.street || a.address, a.address2, [a.zip || a.postal_code, a.city].filter(Boolean).join(' '), a.countryCodeV2 || a.country].filter(Boolean);
  for (const line of lines(prepared.invoice.customer_name, mm(80), 11, true)) { text(line, left, y, 11, true); y += 5.5; }
  for (const line of lines(address.join('\n'), mm(80), 9.5)) { text(line, left, y, 9.5, false, false, muted); y += 5; }
  y = Math.max(92, y + 12);
  paragraph(`Rechnung Nr. ${prepared.number}`, 16, true);
  paragraph(`Auftrag: ${prepared.order_number}`, 9);
  paragraph(`Rechnungsdatum: ${date(prepared.invoice.invoice_date)} · Fällig am: ${date(prepared.invoice.due_date ?? prepared.invoice.invoice_date)}`, 9);
  y += 5;
  paragraph(`Sehr geehrte Damen und Herren,`, 10);
  paragraph(`vielen Dank für Ihren Auftrag. Nachfolgend erhalten Sie die Rechnung ${prepared.number} vom ${date(prepared.invoice.invoice_date)}.`, 9);
  y += 4;
  const header = () => {
    page.drawRectangle({ x: left, y: 841.89 - mm(y + 3), width, height: mm(8), color: rgb(243 / 255, 240 / 255, 232 / 255) });
    text('Position', left + mm(2), y, 9, true);
    text('Menge', left + mm(96), y, 9, true, true);
    text('Einzelpreis', left + mm(122), y, 9, true, true);
    text('Betrag', right - mm(2), y, 9, true, true);
    y += 8;
  };
  if (y > 233) newPage();
  header();
  for (const item of snapshot.items) {
    const nameLines = lines(`${item.name}${item.sku ? ` (${item.sku})` : ''}`, mm(88));
    if (y + Math.min(nameLines.length, 5) * 4.6 + 5 > 242) { newPage(); header(); }
    text(item.quantity, left + mm(96), y, 9, false, true);
    // Display unit price only; never recalculate the stored line amount or tax totals.
    text(money(item.quantity ? item.amount / item.quantity : item.amount), left + mm(122), y, 9, false, true);
    text(money(item.amount), right - mm(2), y, 9, false, true);
    for (const line of nameLines) {
      if (y > 242) { newPage(); header(); }
      text(line, left + mm(2), y); y += 4.6;
    }
    y += 3; rule(y - 1.5);
  }
  if (y + 35 + snapshot.tax_lines.length * 5.5 > 245) newPage();
  y += 6;
  const total = (label: string, amount: number, strong = false) => {
    text(label, right - mm(55), y, strong ? 11 : 9.5, strong, true);
    text(money(amount), right - mm(2), y, strong ? 11 : 9.5, strong, true);
    y += strong ? 8 : 5.5;
  };
  total('Zwischensumme netto', snapshot.net);
  for (const t of snapshot.tax_lines) total(`${t.title} (${Math.round(t.rate * 10000) / 100} %)`, t.amount);
  total('USt. gesamt', snapshot.tax);
  total('Gesamtbetrag', snapshot.total, true);
  y += 5;
  paragraph(paymentText(snapshot));
  if (snapshot.balance > 0) paragraph('Bitte überweisen Sie den offenen Betrag auf die unten angegebene Bankverbindung.');
  if (y + 33 > 249) newPage(); else y += 18;
  paragraph('Mit freundlichen Grüßen', 10);
  y += 2; paragraph('Alix Lasers Finance', 10, true);
  return doc.save();
}
