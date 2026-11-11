import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { paymentText } from '../_shared/shopify-invoice-rules.ts';

export async function createInvoicePdf(prepared: any): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const response = await fetch('https://alixwork.de/__l5e/assets-v1/bd6a7a37-f311-4e47-8d59-177f546680e8/kontoauszug-vorlage.png', { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Rechnungsvorlage nicht verfügbar.');
  const bg = await doc.embedPng(await response.arrayBuffer());
  const snapshot = prepared.snapshot;
  const money = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: snapshot.currency });
  const clean = (v: unknown) => String(v ?? '').replace(/[\r\t]/g, ' ').replace(/[^\x20-\xFF€\n]/g, '?');
  let page = doc.addPage([595.28, 841.89]); let y = 700;
  const paint = () => { page.drawImage(bg, { x: 0, y: 0, width: 595.28, height: 841.89 }); };
  paint();
  const text = (value: unknown, strong = false, size = 10) => {
    const font = strong ? bold : normal;
    for (const paragraph of clean(value).split('\n')) {
      let line = '';
      const draw = () => {
        if (y < 100) { page = doc.addPage([595.28, 841.89]); paint(); y = 710; }
        page.drawText(line, { x: 70, y, size, font, color: rgb(0.1, 0.1, 0.1) }); y -= size + 6;
      };
      for (const word of paragraph.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > 455 && line) { draw(); line = word; } else line = next;
        while (font.widthOfTextAtSize(line, size) > 455) { let cut = line.length - 1; while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > 455) cut--; const rest = line.slice(cut); line = line.slice(0, cut); draw(); line = rest; }
      }
      draw();
    }
  };
  text(prepared.invoice.customer_name, true, 12);
  const a = prepared.invoice.billing_address ?? {};
  text([a.company, a.address1 || a.street || a.address, a.address2, [a.zip || a.postal_code, a.city].filter(Boolean).join(' '), a.countryCodeV2 || a.country].filter(Boolean).join('\n'));
  y -= 15; text(`Rechnung Nr. ${prepared.number}`, true, 17);
  text(`Auftrag: ${prepared.order_number}`);
  text(`Rechnungsdatum / Fälligkeit: ${prepared.invoice.invoice_date}`);
  text('Alix Lasers GmbH · Zeppelin Straße 3 · 12529 Berlin-Schönefeld · USt-IdNr. DE321691012', false, 8);
  y -= 10;
  for (const item of snapshot.items) { text(`${item.quantity} × ${item.name}${item.sku ? ` (${item.sku})` : ''}`, true); text(`${snapshot.tax_included ? 'inkl.' : 'zzgl.'} USt.: ${money(item.amount)}`); }
  y -= 10; text(`Netto: ${money(snapshot.net)}`);
  for (const t of snapshot.tax_lines) text(`${t.title} (${Math.round(t.rate * 10000) / 100} %): ${money(t.amount)}`);
  text(`USt. gesamt: ${money(snapshot.tax)}`);
  text(`Gesamtbetrag: ${money(snapshot.total)}`, true, 12);
  text(paymentText(snapshot));
  if (snapshot.balance > 0) text('Deutsche Bank · IBAN DE07 1007 0100 0142 6600 00 · BIC DEUTDEBB101', false, 9);
  y -= 12; text('Mit freundlichen Grüßen · Alix Lasers Finance');
  return doc.save();
}