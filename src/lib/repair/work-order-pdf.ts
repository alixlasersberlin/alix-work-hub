/**
 * Repair Work Order PDF – HTML-basiert, druckt via window.print()
 * oder lädt als HTML-Datei (kein zusätzlicher PDF-Library-Aufwand).
 */
type RenderInput = {
  repair: any;
  intake: any;
  workOrder: any;
  parts: any[];
};

function escape(s: any): string {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function buildHtml({ repair, intake, workOrder, parts }: RenderInput): string {
  const today = new Date().toLocaleDateString('de-DE');
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
      ${repair.order_id ? `<div>Auftrag: ${escape(repair.order_id)}</div>` : ''}
      <div>Datum: ${today}</div>
    </div>
    <div class="col" style="text-align:right">
      <div class="label">Priorität</div>
      <div class="val">${escape(repair.priority)}</div>
    </div>
  </div>

  <h2>Kunde</h2>
  <table>
    <tr><th>Firma / Kunde</th><td>${escape(repair.customer_company)}</td><th>Ansprechpartner</th><td>${escape(repair.customer_contact)}</td></tr>
    <tr><th>Telefon</th><td>${escape(repair.customer_phone)}</td><th>E-Mail</th><td>${escape(repair.customer_email)}</td></tr>
    <tr><th>Adresse</th><td colspan="3">${escape(repair.customer_street)}, ${escape(repair.customer_zip)} ${escape(repair.customer_city)}</td></tr>
  </table>

  <h2>Gerät</h2>
  <table>
    <tr><th>Gerätetyp</th><td>${escape(repair.device_type)}</td><th>Seriennummer</th><td>${escape(repair.serial_number)}</td></tr>
    <tr><th>Zubehör</th><td colspan="3">${escape(repair.accessories)}</td></tr>
  </table>

  <h2>Fehler (Kunde)</h2>
  <div class="box">${escape(repair.customer_error_description)}</div>
  <div class="row" style="margin-top:6px">
    <div class="col"><span class="label">Einschaltbar:</span> <b>${repair.powers_on ? 'Ja' : 'Nein'}</b></div>
    <div class="col"><span class="label">Dauerhaft:</span> <b>${repair.error_permanent ? 'Ja' : 'Nein'}</b></div>
    <div class="col"><span class="label">Sichtbare Schäden:</span> ${escape(repair.visible_damages)}</div>
  </div>

  ${intake ? `
  <h2>Werkstattannahme</h2>
  <table>
    <tr><th>Eingang</th><td>${escape(intake.arrival_date)}</td><th>Zustand</th><td>${escape(intake.condition_on_arrival)}</td></tr>
    <tr><th>Seriennr. geprüft</th><td>${intake.serial_checked ? 'Ja' : 'Nein'}</td><th>Zubehör geprüft</th><td>${intake.accessories_checked ? 'Ja' : 'Nein'}</td></tr>
    <tr><th>Sichtprüfung</th><td colspan="3">${escape(intake.visual_check)}</td></tr>
  </table>` : ''}

  <h2>Aufgabe</h2><div class="box">${escape(workOrder?.task_description)}</div>
  <h2>Diagnose</h2><div class="box">${escape(workOrder?.diagnosis)}</div>
  <h2>Durchgeführte Arbeiten</h2><div class="box">${escape(workOrder?.work_performed)}</div>

  <h2>Ersatzteile</h2>
  <table><thead><tr><th>Name</th><th>SKU</th><th>Menge</th><th>Grund</th></tr></thead>
  <tbody>${parts.length ? parts.map((p) => `<tr><td>${escape(p.name)}</td><td>${escape(p.sku)}</td><td>${escape(p.quantity)}</td><td>${escape(p.reason)}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#999">–</td></tr>'}</tbody></table>

  <div class="row" style="margin-top:8px">
    <div class="col"><span class="label">Arbeitszeit:</span> <b>${escape(workOrder?.work_time_minutes)} Min.</b></div>
    <div class="col"><span class="label">Testlauf:</span> ${workOrder?.test_run_done ? 'Ja' : 'Nein'}</div>
    <div class="col"><span class="label">Sicherheitsprüfung:</span> ${workOrder?.safety_check_done ? 'Ja' : 'Nein'}</div>
    <div class="col"><span class="label">Erfolgreich:</span> ${workOrder?.repair_successful ? 'Ja' : 'Nein'}</div>
  </div>

  <h2>Abschlussbemerkung</h2><div class="box">${escape(workOrder?.closing_note)}</div>

  <div class="sig">Unterschrift Techniker: ${escape(workOrder?.technician_signature_name)} ${workOrder?.signed_at ? '· ' + new Date(workOrder.signed_at).toLocaleString('de-DE') : ''}</div>
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
