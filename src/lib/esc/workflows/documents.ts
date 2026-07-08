// Document generator registry. Each template returns a printable HTML
// blob today; PDF backends can be plugged later without changing callers.

export type EscDocTemplate =
  | 'servicebericht' | 'uebergabeprotokoll' | 'teilnahmebestaetigung'
  | 'schulungsunterlagen' | 'lieferschein' | 'wartungsprotokoll' | 'besuchsbericht'
  | 'zertifikat';

export const DOC_TEMPLATE_LABELS: Record<EscDocTemplate, string> = {
  servicebericht: 'Servicebericht',
  uebergabeprotokoll: 'Übergabeprotokoll',
  teilnahmebestaetigung: 'Teilnahmebestätigung',
  schulungsunterlagen: 'Schulungsunterlagen',
  lieferschein: 'Lieferschein',
  wartungsprotokoll: 'Wartungsprotokoll',
  besuchsbericht: 'Besuchsbericht',
  zertifikat: 'Zertifikat',
};

export interface DocContext {
  title: string;
  customer?: string | null;
  address?: string | null;
  date?: string | null;
  employees?: string[];
  device?: string | null;
  notes?: string | null;
}

export function renderDocumentHtml(template: EscDocTemplate, ctx: DocContext): string {
  const label = DOC_TEMPLATE_LABELS[template];
  return `<!doctype html><html><head><meta charset="utf-8"><title>${label}</title>
<style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{margin:0 0 16px;font-size:22px}
.meta{color:#555;font-size:12px;margin-bottom:24px}.row{display:flex;gap:16px;margin:6px 0}
.row b{width:160px;display:inline-block;color:#333}.footer{margin-top:48px;border-top:1px solid #ddd;padding-top:12px;font-size:10px;color:#888}</style>
</head><body>
<h1>${label}</h1>
<div class="meta">AlixWorks Enterprise Scheduling Center</div>
<div class="row"><b>Termin</b><span>${escapeHtml(ctx.title)}</span></div>
<div class="row"><b>Kunde</b><span>${escapeHtml(ctx.customer || '')}</span></div>
<div class="row"><b>Adresse</b><span>${escapeHtml(ctx.address || '')}</span></div>
<div class="row"><b>Datum</b><span>${escapeHtml(ctx.date || '')}</span></div>
<div class="row"><b>Gerät</b><span>${escapeHtml(ctx.device || '')}</span></div>
<div class="row"><b>Mitarbeiter</b><span>${(ctx.employees || []).map(escapeHtml).join(', ')}</span></div>
<div class="row"><b>Notizen</b><span>${escapeHtml(ctx.notes || '')}</span></div>
<div class="footer">Automatisch generiert · alixworks.de</div>
</body></html>`;
}

export function downloadDocument(template: EscDocTemplate, ctx: DocContext) {
  const html = renderDocumentHtml(template, ctx);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${template}-${(ctx.customer || 'kunde').replace(/\s+/g, '_')}.html`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
