/**
 * Repair Work Order PDF – HTML-basiert, druckt via window.print()
 * oder lädt als HTML-Datei.
 */
type RenderInput = {
  repair: any;
  parts: any[];
};

function escape(s: any): string {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function buildHtml({ repair, parts }: RenderInput): string {
  const today = new Date().toLocaleDateString('de-DE');
  const device = [repair.device_brand, repair.device_model].filter(Boolean).join(' ') || repair.device_category || '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Arbeitsauftrag ${escape(repair.repair_number)}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; color: #111; padding: 24px; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    h2 { font-size: 13px; margin: 16px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #999; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    td, th { padding: 4px 6px; border: 1px solid #ddd; text-align: left; vertical-align: top; }
    th { background: #f3f3f3; }
    .row { display: flex; gap: 16px; }
    .col { flex: 1; }
    .label { color: #666; font-size: 10px; text-transform: uppercase; }
    .val { font-weight: 600; }
    .box { border: 1px solid #ccc; padding: 8px; min-height: 40px; margin-top: 2px; }
    .sig { margin-top: 32px; border-top: 1px solid #000; padding-top: 4px; }
    @media print { body { padding: 12mm; } }
  </style></head><body>
  <div class="row">
    <div class="col">
      <h1>Technik-Arbeitsauftrag</h1>
      <div>Reparaturnummer: <span class="val">${escape(repair.repair_number)}</span></div>
      ${repair.order_number ? `<div>Zoho-Auftrag: ${escape(repair.order_number)}</div>` : ''}
      <div>Datum: ${today}</div>
    </div>
    <div class="col" style="text-align:right">
      <div class="label">Status</div>
      <div class="val">${escape(repair.repair_status)}</div>
    </div>
  </div>

  <h2>Kunde</h2>
  <table>
    <tr><th>Kunde / Firma</th><td>${escape(repair.customer_name)}</td></tr>
    <tr><th>E-Mail</th><td>${escape(repair.customer_email)}</td></tr>
    <tr><th>Telefon</th><td>${escape(repair.customer_phone)}</td></tr>
  </table>

  <h2>Gerät</h2>
  <table>
    <tr><th>Kategorie</th><td>${escape(repair.device_category)}</td><th>Marke / Modell</th><td>${escape(device)}</td></tr>
    <tr><th>Seriennummer</th><td>${escape(repair.device_serial_number)}</td><th>Zubehör</th><td>${escape(repair.accessories)}</td></tr>
  </table>

  <h2>Fehlerbeschreibung Kunde</h2>
  <div class="box">${escape(repair.issue_description)}</div>

  <h2>Diagnose</h2>
  <div class="box">${escape(repair.diagnosis)}</div>

  <h2>Ersatzteile</h2>
  <table><thead><tr><th>Bezeichnung</th><th>SKU</th><th>Menge</th><th>Lieferant</th><th>Status</th></tr></thead>
  <tbody>${parts.length ? parts.map((p) => `<tr><td>${escape(p.item_name)}</td><td>${escape(p.sku)}</td><td>${escape(p.quantity)}</td><td>${escape(p.supplier_name)}</td><td>${escape(p.order_status)}</td></tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:#999">–</td></tr>'}</tbody></table>

  <div class="row" style="margin-top:8px">
    <div class="col"><span class="label">Kostenvoranschlag:</span> <b>${escape(repair.estimated_cost)} ${escape(repair.currency || 'EUR')}</b></div>
    <div class="col"><span class="label">Tatsächliche Kosten:</span> <b>${escape(repair.actual_cost)} ${escape(repair.currency || 'EUR')}</b></div>
  </div>

  <h2>Interne Notizen</h2><div class="box">${escape(repair.internal_notes)}</div>

  <div class="sig">Unterschrift Techniker: _______________________________ &nbsp; Datum: _____________</div>
  </body></html>`;
}

export function renderRepairWorkOrderPdf(input: RenderInput, action: 'print' | 'download') {
  const html = buildHtml(input);
  if (action === 'print') {
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  } else {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Arbeitsauftrag-${input.repair.repair_number || 'reparatur'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
