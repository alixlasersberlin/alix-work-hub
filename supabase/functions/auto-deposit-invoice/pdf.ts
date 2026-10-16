import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

const TEMPLATE = 'https://alixwork.de/__l5e/assets-v1/954f3aef-7d07-4ff4-aec9-cbe9b48c0a58/az-rechnung-template.jpg';
const LOGO = 'https://alixwork.de/__l5e/assets-v1/62ec35b5-5b0b-42a6-b4cd-28fa1a1135db/alix-logo-gold-pdf.png';

export async function createDepositPdf(order: any, customer: any, deposit: any, number: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const color = rgb(0.08, 0.23, 0.43);
  const mm = (v: number) => v * 72 / 25.4;
  const left = mm(30), right = mm(195);
  const responses = await Promise.all([fetch(TEMPLATE), fetch(LOGO)]);
  if (responses.some(r => !r.ok)) throw new Error('Rechnungsvorlage konnte nicht geladen werden');
  const [background, logo] = await Promise.all(responses.map(r => r.arrayBuffer()));
  page.drawImage(await doc.embedJpg(background), { x: 0, y: 0, width: 595.28, height: 841.89 });
  page.drawImage(await doc.embedPng(logo), { x: right - mm(54), y: 841.89 - mm(22), width: mm(54), height: mm(10) });
  const clean = (s: unknown) => String(s ?? '').replace(/[\r\n\t]/g, ' ').replace(/[\u0000-\u001f]/g, '').replace(/[^\u0020-\u00ff€]/g, '?');
  const text = (value: unknown, x: number, top: number, size = 10, strong = false) => {
    page.drawText(clean(value), { x, y: 841.89 - mm(top), size, font: strong ? bold : normal, color });
  };
  const wrap = (value: unknown, top: number, size = 10, strong = false) => {
    const words = clean(value).split(/\s+/); let line = ''; let y = top;
    const font = strong ? bold : normal;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > right - left && line) { text(line, left, y, size, strong); y += 5; line = word; }
      else line = next;
    }
    if (line) text(line, left, y, size, strong);
    return y + 5;
  };
  const money = (value: unknown) => Number(value || 0).toLocaleString('de-DE', { style: 'currency', currency: deposit.currency || 'EUR' });
  const date = (v: string) => new Date(v).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
  text('Anzahlungsrechnung', left, 55, 20, true);
  text(`Rechnungsnummer: ${number}`, left, 66, 10, true);
  text(`Beleg-ID: AZ-${order.order_number}`, left, 72, 9);
  text(`Auftrag: ${order.order_number}`, left, 78, 9);
  text(`Rechnungsdatum: ${date(deposit.issue_date)}   Fällig am: ${date(deposit.due_date)}`, left, 84, 9);
  text('Alix Lasers GmbH · Zeppelin Straße 3 · 12529 Berlin-Schönefeld · USt-IdNr. DE321691012', left, 96, 7);
  let y = wrap(customer.company_name || customer.contact_name, 106, 11, true);
  if (customer.company_name && customer.contact_name && customer.company_name !== customer.contact_name) y = wrap(customer.contact_name, y);
  const address = customer.billing_address || order.billing_address || {};
  for (const line of [address.address || address.street, address.street2, [address.zip || address.postal_code, address.city].filter(Boolean).join(' '), address.country]) {
    if (line) y = wrap(line, y);
  }
  y = wrap('Vielen Dank für Ihre Bestellung. Vereinbarungsgemäß stellen wir Ihnen hiermit die Anzahlung in Rechnung.', Math.max(y + 12, 142));
  y += 7;
  y = wrap(`1. Anzahlung gemäß Auftrag ${order.order_number}`, y, 11, true);
  const net = Number(deposit.net_amount), vat = Number(deposit.vat_amount);
  const rate = net > 0 ? Math.round(vat / net * 1000) / 10 : 0;
  for (const [label, value] of [['Netto', money(net)], [`MwSt (${rate} %)`, money(vat)], ['Rechnungsbetrag brutto', money(deposit.gross_amount)]]) {
    y += 7; text(label, left, y, 11, label === 'Rechnungsbetrag brutto');
    const font = label === 'Rechnungsbetrag brutto' ? bold : normal;
    text(value, right - font.widthOfTextAtSize(clean(value), 11), y, 11, label === 'Rechnungsbetrag brutto');
  }
  y = wrap(`Bitte überweisen Sie den Rechnungsbetrag bis zum ${date(deposit.due_date)} unter Angabe der Rechnungsnummer ${number}. Die Anzahlung wird auf den vereinbarten Gesamtbetrag angerechnet.`, y + 15, 9);
  y += 6;
  for (const line of ['Kontoinhaber: Alix Lasers GmbH', 'Bank: Deutsche Bank', 'IBAN: DE07 1007 0100 0142 6600 00', 'SWIFT/BIC: DEUTDEBB101']) { text(line, left, y, 9); y += 5; }
  text('Mit freundlichen Grüßen · Alix Lasers Finance', left, y + 8, 10, true);
  text('Alix Lasers GmbH · HRB 245388 · Amtsgericht Berlin-Charlottenburg', left, 283, 7);
  text(`Anzahlungsrechnung ${number} · Seite 1 von 1`, left, 289, 7);
  return doc.save();
}