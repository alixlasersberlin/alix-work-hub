/**
 * Repair Cost Estimate / Kostenvoranschlag PDF (HTML, druckbar).
 * Wird als Blob zurückgegeben, der dann im Storage abgelegt oder
 * direkt im Browser geöffnet werden kann.
 */
export type QuoteItem = {
  kind: 'part' | 'labor' | 'shipping' | 'other';
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type QuoteDoc = {
  repair: any;
  quote: any;
  items: QuoteItem[];
};

function esc(s: any): string {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function fmt(n: any) {
  const v = Number(n || 0);
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildHtml({ repair, quote, items }: QuoteDoc): string {
  const today = new Date().toLocaleDateString('de-DE');
  const device = [repair?.device_brand, repair?.device_model].filter(Boolean).join(' ') || repair?.device_category || '';
  const rows = items
    .map(
      (i) => `<tr>
      <td>${esc(i.kind === 'labor' ? 'Arbeitszeit' : i.kind === 'shipping' ? 'Versand' : i.kind === 'part' ? 'Ersatzteil' : 'Sonstiges')}</td>
      <td>${esc(i.description)}</td>
      <td style="text-align:right">${fmt(i.quantity)}</td>
      <td style="text-align:right">${fmt(i.unit_price)} €</td>
      <td style="text-align:right">${fmt(i.line_total)} €</td>
    </tr>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Kostenvoranschlag ${esc(quote.quote_number)}</title>
  <style>
    body { font-family: -apple-system, system-ui, Arial, sans-serif; color: #111; padding: 24px; font-size: 12px; }
    h1 { font-size: 20px; margin: 0 0 4px; color: #0f172a; }
    h2 { font-size: 13px; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #999; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    td, th { padding: 6px 8px; border: 1px solid #ddd; text-align: left; vertical-align: top; }
    th { background: #f3f3f3; }
    .row { display: flex; gap: 16px; }
    .col { flex: 1; }
    .label { color: #666; font-size: 10px; text-transform: uppercase; }
    .val { font-weight: 600; }
    .sum { text-align:right; padding: 4px 8px; }
    .sum td { border: none; }
    .total { font-size: 14px; font-weight: 700; background:#f8fafc; }
    .note { background: #fffbea; border: 1px solid #fde68a; padding: 8px; margin-top: 10px; }
    @media print { body { padding: 12mm; } }
  </style></head><body>
  <div class="row">
    <div class="col">
      <h1>Kostenvoranschlag</h1>
      <div>Nummer: <span class="val">${esc(quote.quote_number)}</span></div>
      <div>Reparaturnr.: ${esc(repair?.repair_number)}</div>
      <div>Datum: ${today}</div>
    </div>
    <div class="col" style="text-align:right">
      <div class="label">Status</div>
      <div class="val">${esc(quote.status)}</div>
    </div>
  </div>

  <h2>Kunde</h2>
  <table>
    <tr><th style="width:25%">Kunde / Firma</th><td>${esc(repair?.customer_name)}</td></tr>
    <tr><th>E-Mail</th><td>${esc(repair?.customer_email)}</td><th>Telefon</th><td>${esc(repair?.customer_phone)}</td></tr>
  </table>

  <h2>Gerät</h2>
  <table>
    <tr><th>Marke / Modell</th><td>${esc(device)}</td><th>Seriennummer</th><td>${esc(repair?.device_serial_number)}</td></tr>
  </table>

  <h2>Positionen</h2>
  <table>
    <thead><tr><th style="width:14%">Art</th><th>Beschreibung</th><th style="width:8%">Menge</th><th style="width:14%">Einzelpreis</th><th style="width:14%">Summe</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#888">Keine Positionen</td></tr>'}</tbody>
  </table>

  <table class="sum" style="margin-top:8px">
    <tr><td style="width:80%">Arbeitszeit</td><td>${fmt(quote.labor_total)} €</td></tr>
    <tr><td>Ersatzteile</td><td>${fmt(quote.parts_total)} €</td></tr>
    <tr><td>Versand</td><td>${fmt(quote.shipping_total)} €</td></tr>
    <tr><td>Netto</td><td>${fmt(quote.total_net)} €</td></tr>
    <tr><td>zzgl. ${fmt(quote.vat_rate)} % MwSt.</td><td>${fmt((quote.total_gross || 0) - (quote.total_net || 0))} €</td></tr>
    <tr class="total"><td>Gesamtbetrag (brutto)</td><td>${fmt(quote.total_gross)} €</td></tr>
  </table>

  ${quote.customer_note ? `<div class="note"><b>Hinweis für den Kunden:</b><br/>${esc(quote.customer_note)}</div>` : ''}

  <p style="margin-top:24px;color:#64748b;font-size:11px">Dieser Kostenvoranschlag ist 30 Tage gültig. Mit der Freigabe beauftragen Sie die Reparatur zu den aufgeführten Konditionen.</p>
  </body></html>`;
}

export function renderRepairQuoteHtml(doc: QuoteDoc): string {
  return buildHtml(doc);
}

export function downloadRepairQuoteHtml(doc: QuoteDoc) {
  const html = buildHtml(doc);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Kostenvoranschlag-${doc.quote.quote_number || 'KV'}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function printRepairQuote(doc: QuoteDoc) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(buildHtml(doc));
  w.document.close();
  setTimeout(() => w.print(), 400);
}

export function repairQuoteHtmlBlob(doc: QuoteDoc): Blob {
  return new Blob([buildHtml(doc)], { type: 'text/html' });
}
