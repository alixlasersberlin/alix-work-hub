// Servicebericht-PDF (Print-HTML). Wird über window.print() ausgelöst und
// optional als HTML-Blob in den repair-files Bucket gespeichert.

export interface ServiceReportData {
  tour: any;
  attachments?: { file_name?: string | null; file_path: string }[];
  parts?: { part_name: string; part_sku?: string | null; quantity: number; note?: string | null }[];
  signatureDataUrl?: string | null;
}

function esc(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function fmtDate(d: any) {
  if (!d) return '';
  try { return new Date(d).toLocaleString('de-DE'); } catch { return String(d); }
}

export function serviceReportHtml(data: ServiceReportData): string {
  const t = data.tour || {};
  const parts = data.parts || [];
  const att = data.attachments || [];
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"/>
<title>Servicebericht ${esc(t.id || '')}</title>
<style>
  body{font-family:Arial,sans-serif;color:#111;padding:32px;max-width:820px;margin:auto}
  h1{font-size:20px;margin:0 0 4px}
  h2{font-size:14px;margin:24px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px}
  .row{display:flex;gap:16px;flex-wrap:wrap}
  .row>div{flex:1;min-width:200px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}
  th{background:#f4f4f4}
  .muted{color:#666;font-size:11px}
  .sig{margin-top:24px;border-top:1px solid #aaa;padding-top:12px}
  .sig img{max-height:120px;max-width:320px;border:1px solid #ddd;padding:4px}
  @media print{.noprint{display:none}}
</style></head><body>
  <h1>Servicebericht</h1>
  <div class="muted">Einsatznummer: ${esc(t.id || '')} · Datum: ${esc(t.planned_date || fmtDate(t.created_at))}</div>

  <h2>Kunde</h2>
  <div class="row">
    <div><b>Name:</b> ${esc(t.contact_name || '')}</div>
    <div><b>Telefon:</b> ${esc(t.contact_phone || '')}</div>
    <div><b>E-Mail:</b> ${esc(t.contact_email || '')}</div>
  </div>
  <div><b>Adresse:</b> ${esc(typeof t.location_address === 'string' ? t.location_address : (t.location_address?.raw || ''))}</div>

  <h2>Gerät</h2>
  <div class="row">
    <div><b>Modell:</b> ${esc(t.device_model || '')}</div>
    <div><b>Seriennummer:</b> ${esc(t.device_serial_number || '')}</div>
  </div>

  <h2>Einsatz</h2>
  <div class="row">
    <div><b>Einsatzart:</b> ${esc(t.tour_type || '')}</div>
    <div><b>Status:</b> ${esc(t.planning_status || '')}</div>
    <div><b>Priorität:</b> ${esc(t.priority || '')}</div>
  </div>
  <div class="row">
    <div><b>Check-in:</b> ${esc(fmtDate(t.check_in_at))}</div>
    <div><b>Check-out:</b> ${esc(fmtDate(t.check_out_at))}</div>
  </div>
  <div class="row">
    <div><b>Arbeitsbeginn:</b> ${esc(fmtDate(t.work_started_at))}</div>
    <div><b>Arbeitsende:</b> ${esc(fmtDate(t.work_ended_at))}</div>
  </div>

  <h2>Fehlerbeschreibung</h2>
  <div>${esc(t.fault_description || '-')}</div>

  <h2>Durchgeführte Arbeiten</h2>
  <div>${esc(t.work_performed || '-')}</div>

  <h2>Verwendete Ersatzteile</h2>
  ${parts.length === 0 ? '<div class="muted">Keine</div>' : `
  <table><thead><tr><th>Bezeichnung</th><th>SKU</th><th>Menge</th><th>Notiz</th></tr></thead>
  <tbody>${parts.map(p => `<tr><td>${esc(p.part_name)}</td><td>${esc(p.part_sku || '')}</td><td>${esc(p.quantity)}</td><td>${esc(p.note || '')}</td></tr>`).join('')}</tbody></table>`}

  <h2>Ergebnis</h2>
  <div><b>Ergebnis:</b> ${esc(t.result_outcome || '-')}</div>
  <div><b>Nächster Schritt:</b> ${esc(t.next_step || '-')}</div>

  ${att.length > 0 ? `<h2>Anhänge</h2><ul>${att.map(a => `<li>${esc(a.file_name || a.file_path)}</li>`).join('')}</ul>` : ''}

  <div class="sig">
    <div><b>Techniker:</b> ${esc(t.assigned_employee || '')}</div>
    ${data.signatureDataUrl ? `<div style="margin-top:8px"><b>Kundenunterschrift:</b><br/><img src="${data.signatureDataUrl}"/></div>` : '<div style="margin-top:24px">Unterschrift Kunde: ________________________</div>'}
  </div>

  <div class="noprint" style="margin-top:24px"><button onclick="window.print()">Drucken</button></div>
</body></html>`;
}

export function printServiceReport(data: ServiceReportData) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(serviceReportHtml(data));
  w.document.close();
  setTimeout(() => w.print(), 400);
}

export function serviceReportBlob(data: ServiceReportData): Blob {
  return new Blob([serviceReportHtml(data)], { type: 'text/html' });
}
