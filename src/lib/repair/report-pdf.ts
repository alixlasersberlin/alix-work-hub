/**
 * Reparaturbericht – HTML/PDF, druckbar oder als Blob speicherbar.
 */
type ReportDoc = {
  repair: any;
  parts: any[];
  history?: any[];
  technician?: string;
};

function esc(s: any): string {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function buildHtml({ repair, parts, history = [], technician }: ReportDoc): string {
  const today = new Date().toLocaleDateString('de-DE');
  const device = [repair?.device_brand, repair?.device_model].filter(Boolean).join(' ') || repair?.device_category || '';
  const partsRows = parts
    .map(
      (p: any) =>
        `<tr><td>${esc(p.part_name || p.name)}</td><td>${esc(p.sku || '')}</td><td style="text-align:right">${esc(p.quantity || 1)}</td><td>${esc(p.status || '')}</td></tr>`,
    )
    .join('');
  const histRows = history
    .slice(0, 20)
    .map(
      (h: any) =>
        `<tr><td>${new Date(h.created_at).toLocaleString('de-DE')}</td><td>${esc(h.old_status || '–')}</td><td>${esc(h.new_status)}</td><td>${esc(h.change_note || '')}</td></tr>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Reparaturbericht ${esc(repair.repair_number)}</title>
  <style>
    body { font-family: -apple-system, system-ui, Arial, sans-serif; color: #111; padding: 24px; font-size: 12px; }
    h1 { font-size: 20px; margin: 0 0 4px; color: #0f172a; }
    h2 { font-size: 13px; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #999; }
    table { width: 100%; border-collapse: collapse; }
    td, th { padding: 5px 8px; border: 1px solid #ddd; text-align: left; vertical-align: top; }
    th { background: #f3f3f3; }
    .row { display: flex; gap: 16px; }
    .col { flex: 1; }
    .box { border: 1px solid #ccc; padding: 8px; min-height: 32px; margin-top: 2px; white-space:pre-wrap; }
    .sig { margin-top: 36px; border-top: 1px solid #000; padding-top: 4px; width:40%; }
    @media print { body { padding: 12mm; } }
  </style></head><body>
  <div class="row">
    <div class="col">
      <h1>Reparaturbericht</h1>
      <div>Reparaturnr.: <b>${esc(repair.repair_number)}</b></div>
      <div>Datum: ${today}</div>
    </div>
    <div class="col" style="text-align:right">
      <div style="color:#666;font-size:10px;text-transform:uppercase">Status</div>
      <div style="font-weight:600">${esc(repair.repair_status)}</div>
    </div>
  </div>

  <h2>Kunde &amp; Gerät</h2>
  <table>
    <tr><th style="width:22%">Kunde</th><td>${esc(repair.customer_name)}</td><th>E-Mail</th><td>${esc(repair.customer_email)}</td></tr>
    <tr><th>Telefon</th><td>${esc(repair.customer_phone)}</td><th>Auftrag (Zoho)</th><td>${esc(repair.order_number || '–')}</td></tr>
    <tr><th>Marke / Modell</th><td>${esc(device)}</td><th>Seriennummer</th><td>${esc(repair.device_serial_number)}</td></tr>
    <tr><th>Kaufdatum</th><td>${esc(repair.purchase_date || '–')}</td><th>Techniker</th><td>${esc(technician || '–')}</td></tr>
  </table>

  <h2>Fehlerbild / Kundenbeschreibung</h2>
  <div class="box">${esc(repair.issue_description || repair.customer_error_description || '–')}</div>

  <h2>Diagnose / Ursache</h2>
  <div class="box">${esc(repair.diagnosis || '–')}</div>

  <h2>Durchgeführte Arbeiten</h2>
  <div class="box">${esc(repair.internal_notes || '–')}</div>

  <h2>Verwendete Ersatzteile</h2>
  <table>
    <thead><tr><th>Bezeichnung</th><th>SKU</th><th style="width:8%">Menge</th><th style="width:18%">Status</th></tr></thead>
    <tbody>${partsRows || '<tr><td colspan="4" style="text-align:center;color:#888">Keine Ersatzteile verbaut</td></tr>'}</tbody>
  </table>

  ${
    histRows
      ? `<h2>Statusverlauf</h2><table><thead><tr><th>Datum</th><th>von</th><th>nach</th><th>Hinweis</th></tr></thead><tbody>${histRows}</tbody></table>`
      : ''
  }

  <div class="row" style="margin-top:30px">
    <div class="sig">Techniker</div>
    <div class="sig" style="margin-left:auto">Endkontrolle / Freigabe</div>
  </div>
  </body></html>`;
}

export function renderRepairReportHtml(doc: ReportDoc): string {
  return buildHtml(doc);
}

export function printRepairReport(doc: ReportDoc) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(buildHtml(doc));
  w.document.close();
  setTimeout(() => w.print(), 400);
}

export function repairReportHtmlBlob(doc: ReportDoc): Blob {
  return new Blob([buildHtml(doc)], { type: 'text/html' });
}
