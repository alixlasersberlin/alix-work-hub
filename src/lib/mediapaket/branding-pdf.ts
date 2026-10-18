import autoTable from 'jspdf-autotable';
import { createPDF } from '../pdf-utils';

const LABELS: Record<string, string> = {
  about_me: 'Über mich', studio_description: 'Studio-Beschreibung',
  company_philosophy: 'Unternehmensphilosophie', languages: 'Sprachen',
  preferred_salutation: 'Ansprache', preferred_colors: 'Bevorzugte Farben',
  excluded_colors: 'Ausgeschlossene Farben', slogan: 'Slogan',
  website_examples_positive: 'Website-Vorbilder', website_examples_negative: 'Nicht gewünschte Websites',
  target_age_group: 'Zielgruppe / Alter', regional_focus: 'Regionaler Schwerpunkt',
  unique_selling_points: 'Alleinstellungsmerkmale', other_requirements: 'Weitere Anforderungen',
};
const HIDDEN = new Set(['id', 'media_package_id', 'created_at', 'updated_at', 'customer_id', 'order_id']);

function displayValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.map(displayValue).join(', ') || '—';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Export the full authorized branding record, never the truncated display text. */
export function createBrandingPdf(branding: Record<string, unknown>, studioName?: string): Blob {
  const doc = createPDF({ unit: 'pt', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  doc.setProperties({ title: 'Mediapaket – Branding / Anmerkungen' });
  doc.setFont('Inter', 'bold');
  doc.setFontSize(18);
  doc.text('Branding / Anmerkungen', 40, 48);
  doc.setFont('Inter', 'normal');
  doc.setFontSize(10);
  const subtitle = doc.splitTextToSize(studioName || 'Mediapaket', width - 80);
  doc.text(subtitle, 40, 68);
  autoTable(doc, {
    startY: 82 + subtitle.length * 12,
    head: [['Angabe', 'Inhalt']],
    body: Object.entries(branding).filter(([key]) => !HIDDEN.has(key))
      .map(([key, value]) => [LABELS[key] || key.replace(/_/g, ' '), displayValue(value)]),
    styles: { font: 'Inter', fontSize: 9, cellPadding: 7, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 30, 30], textColor: [212, 175, 55] },
    columnStyles: { 0: { cellWidth: 145, fontStyle: 'bold' } },
    margin: { top: 40, bottom: 40, left: 40, right: 40 },
    rowPageBreak: 'avoid',
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text('Alix Work · Mediapaket', 40, doc.internal.pageSize.getHeight() - 20);
    doc.text(`Seite ${page} / ${pages}`, width - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }
  return doc.output('blob');
}