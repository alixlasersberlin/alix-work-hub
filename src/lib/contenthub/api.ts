import { supabase } from '@/integrations/supabase/client';
import type { ChChannelCode } from './config';

const db = supabase as any;

export interface ChResult {
  product_id: string;
  name?: string;
  hash?: string;
  checks?: { label: string; ok: boolean }[];
  blocked?: string[];
  compliance_required?: boolean;
  rendered?: Record<string, any>;
  channel_state?: any[];
  drift?: string[];
  published?: boolean;
  version?: number;
  error?: string;
}

async function call(action: 'preview' | 'check' | 'publish', payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('content-hub-render', {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.results ?? []) as ChResult[];
}

export const chPreview = (productId: string) => call('preview', { product_id: productId }).then(r => r[0]);
export const chCheck = (productIds: string[]) => call('check', { product_ids: productIds });
export const chPublish = (productIds: string[], channels?: ChChannelCode[], note?: string) =>
  call('publish', { product_ids: productIds, channels, note });

export async function chLoadChannelState() {
  const { data } = await db.from('ch_channel_state').select('*');
  const map: Record<string, Record<string, any>> = {};
  (data ?? []).forEach((s: any) => {
    map[s.product_id] = map[s.product_id] || {};
    map[s.product_id][s.channel] = s;
  });
  return map;
}

export async function chLoadReleases(productId: string) {
  const { data } = await db.from('ch_releases').select('*')
    .eq('product_id', productId).order('version', { ascending: false });
  return data ?? [];
}

/** Datenblatt-PDF aus derselben Kanalausgabe erzeugen (keine zweite Datenpflege). */
export async function chDatasheetPdf(sheet: any) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ format: 'a4', unit: 'pt' });
  const W = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.text(String(sheet.title ?? 'Datenblatt'), 40, 56);
  doc.setFontSize(10);
  doc.text([sheet.model, sheet.sku, sheet.brand].filter(Boolean).join(' · '), 40, 74);
  doc.setFontSize(8);
  doc.text(`Stand: ${sheet.stand ?? new Date().toISOString().slice(0, 10)}`, W - 40, 56, { align: 'right' });

  let y = 100;
  if (sheet.intended_use) {
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(`Zweckbestimmung: ${sheet.intended_use}`, W - 80);
    doc.text(lines, 40, y);
    y += lines.length * 12 + 10;
  }

  autoTable(doc, {
    startY: y,
    head: [['Technische Daten', 'Wert']],
    body: Object.entries(sheet.tech ?? {}).map(([k, v]) => [k, String(v)]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [180, 145, 60] },
  });

  const scope = (sheet.scope ?? []) as any[];
  if (scope.length) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 18,
      head: [['Lieferumfang', 'Menge']],
      body: scope.map(s => [s.title, `${s.quantity ?? ''} ${s.unit ?? ''}`.trim()]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [180, 145, 60] },
    });
  }

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 18,
    head: [['Compliance', 'Angabe']],
    body: Object.entries(sheet.compliance ?? {})
      .filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))
      .map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [40, 40, 40] },
  });

  doc.save(`Datenblatt_${(sheet.sku || sheet.title || 'produkt').toString().replace(/\W+/g, '_')}.pdf`);
}
