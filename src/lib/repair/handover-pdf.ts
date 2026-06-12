import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { sbRepair } from '@/lib/repair/api';

export type HandoverKind = 'finance' | 'delivery';

export interface HandoverDoc {
  key: string;
  label: string;
  required: boolean;
  uploaded: boolean;
  fileName?: string;
  path?: string;
  sizeBytes?: number;
}

export interface HandoverPdfInput {
  kind: HandoverKind;
  repairId: string;
  handoverId: string;
  metadata: Record<string, string | number | null | undefined>;
  checklist: HandoverDoc[];
  signaturePath?: string | null;
  newStatus: string;
  handedOverBy?: string | null;
}

const fmtDate = (d = new Date()) => d.toLocaleString('de-DE');

async function fetchRepairHeader(repairId: string) {
  const { data } = await sbRepair
    .from('repair_orders')
    .select('repair_number,customer_name,device_model,serial_number,repair_status')
    .eq('id', repairId)
    .maybeSingle();
  return data || ({} as any);
}

export async function generateHandoverPdf(input: HandoverPdfInput): Promise<{ blob: Blob; storagePath: string; fileName: string }> {
  const header = await fetchRepairHeader(input.repairId);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = M;

  const title = input.kind === 'finance' ? 'Finance-Übergabe' : 'Auslieferungs-Übergabe';
  doc.setFillColor(235, 238, 242);
  doc.rect(0, 0, W, 60, 'F');
  doc.setTextColor(30, 35, 45);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, M, 38);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 95, 105);
  doc.text(`Reparatur ${header.repair_number || input.repairId.slice(0, 8)}`, W - M, 38, { align: 'right' });
  y = 80;

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Reparatur', M, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const headerLines = [
    ['Reparatur-Nr.', header.repair_number || '–'],
    ['Kunde', header.customer_name || '–'],
    ['Gerät', [header.device_model, header.serial_number].filter(Boolean).join(' · ') || '–'],
    ['Neuer Status', input.newStatus],
    ['Erstellt am', fmtDate()],
  ];
  autoTable(doc, {
    startY: y,
    head: [],
    body: headerLines,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 110, textColor: [80, 80, 80] } },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Übergabe-Metadaten', M, y);
  y += 6;
  const metaRows = Object.entries(input.metadata)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => [k, String(v)]);
  autoTable(doc, {
    startY: y + 4,
    head: [['Feld', 'Wert']],
    body: metaRows.length ? metaRows : [['–', '–']],
    theme: 'striped',
    headStyles: { fillColor: [235, 238, 242], textColor: [55, 65, 81] },
    styles: { fontSize: 10, cellPadding: 4 },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Belege-Checkliste', M, y);
  const checkBody = input.checklist.map((c) => [
    c.uploaded ? '✓' : c.required ? '✗' : '○',
    c.label + (c.required ? ' *' : ''),
    c.uploaded ? 'Hochgeladen' : c.required ? 'FEHLT (Pflicht)' : 'optional',
    c.fileName || '–',
    c.sizeBytes ? `${Math.round(c.sizeBytes / 1024)} KB` : '–',
  ]);
  autoTable(doc, {
    startY: y + 6,
    head: [['', 'Beleg', 'Status', 'Datei', 'Größe']],
    body: checkBody,
    theme: 'grid',
    headStyles: { fillColor: [235, 238, 242], textColor: [55, 65, 81] },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 55, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const v = String(data.cell.raw);
        if (v === '✓') data.cell.styles.textColor = [16, 160, 80];
        else if (v === '✗') data.cell.styles.textColor = [200, 40, 40];
      }
    },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Signatur & Datei-Verweise', M, y);
  y += 6;
  const refRows: string[][] = [];
  if (input.signaturePath) refRows.push(['Signatur', input.signaturePath]);
  input.checklist.filter((c) => c.path).forEach((c) => refRows.push([c.label, c.path!]));
  autoTable(doc, {
    startY: y + 4,
    head: [['Typ', 'Storage-Pfad (Bucket: repair-files)']],
    body: refRows.length ? refRows : [['–', 'Keine Datei-Verweise']],
    theme: 'striped',
    headStyles: { fillColor: [235, 238, 242], textColor: [55, 65, 81] },
    styles: { fontSize: 8, cellPadding: 4, font: 'courier' },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 24;

  doc.setDrawColor(180);
  doc.line(M, y, W - M, y);
  y += 14;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Übergabe-ID: ${input.handoverId} · Generiert: ${fmtDate()} · Alix Work Repair Module`,
    M,
    y,
  );

  const blob = doc.output('blob');
  const fileName = `${input.kind === 'finance' ? 'finance' : 'delivery'}-handover-${(header.repair_number || input.repairId.slice(0, 8))}-${Date.now()}.pdf`;
  const storagePath = `${input.repairId}/handover-pdfs/${fileName}`;

  try {
    const { error } = await supabase.storage.from('repair-files').upload(storagePath, blob, {
      contentType: 'application/pdf',
      upsert: false,
    });
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      await sbRepair.from('repair_attachments').insert({
        repair_order_id: input.repairId,
        file_path: storagePath,
        file_name: fileName,
        mime_type: 'application/pdf',
        size_bytes: blob.size,
        category: input.kind === 'finance' ? 'finance_handover_pdf' : 'delivery_handover_pdf',
        uploaded_by: user?.id,
      });
    }
  } catch (e) {
    console.warn('handover pdf upload failed', e);
  }

  // Trigger browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  return { blob, storagePath, fileName };
}
