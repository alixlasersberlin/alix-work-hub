import { supabase } from '@/integrations/supabase/client';
import { autoFileToAlixDocs, type AlixDocsCategory } from '@/lib/alixdocs/autoFile';
import type { OrderDocKind } from './capture';

export type StepKey = OrderDocKind | 'gesamt';

export type DocRow = {
  id: string;
  title: string;
  created_at: string;
  current_version: number | null;
};

export const STEP_LABELS: Record<StepKey, string> = {
  sepa: 'SEPA Mandat',
  mietkauf: 'Mietkauf',
  ratenplan: 'Ratenplan',
  gesamt: 'Vertragsunterlagen (Gesamt-PDF)',
};

export const STEP_ORDER: StepKey[] = ['sepa', 'mietkauf', 'ratenplan', 'gesamt'];

const CATEGORY: Record<StepKey, AlixDocsCategory> = {
  sepa: 'sonstiges',
  mietkauf: 'mietvertrag',
  ratenplan: 'finanzierung',
  gesamt: 'mietvertrag',
};

/** Titel-Präfix, über das ein bereits vorhandenes Dokument erkannt wird. */
const TITLE_PREFIX: Record<StepKey, string> = {
  sepa: 'SEPA-Mandat',
  mietkauf: 'Mietkauf',
  ratenplan: 'Ratenplan',
  gesamt: 'Vertragsunterlagen',
};

export function docTitle(step: StepKey, orderNumber: string) {
  return `${TITLE_PREFIX[step]} ${orderNumber}`;
}

/** Liest den Fortschritt aus den bereits vorhandenen AlixDocs-Dokumenten des Auftrags. */
export async function loadProgress(orderId: string): Promise<Partial<Record<StepKey, DocRow>>> {
  const { data, error } = await supabase
    .from('alixdocs_documents')
    .select('id, title, created_at, current_version')
    .eq('order_id', orderId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const out: Partial<Record<StepKey, DocRow>> = {};
  for (const row of (data ?? []) as any[]) {
    const title = String(row.title ?? '');
    for (const step of STEP_ORDER) {
      if (out[step]) continue;
      if (title.toLowerCase().startsWith(TITLE_PREFIX[step].toLowerCase())) {
        out[step] = row as DocRow;
      }
    }
  }
  return out;
}

/** Legt eine erzeugte PDF über die bestehende AlixDocs-Auto-Ablage am Auftrag ab. */
export async function fileStepPdf(opts: {
  step: StepKey;
  blob: Blob;
  orderId: string;
  customerId?: string | null;
  orderNumber: string;
  filename?: string;
}) {
  const res = await autoFileToAlixDocs({
    blob: opts.blob,
    filename: opts.filename || `${docTitle(opts.step, opts.orderNumber).replace(/\s+/g, '_')}.pdf`,
    category: CATEGORY[opts.step],
    title: docTitle(opts.step, opts.orderNumber),
    order_id: opts.orderId,
    customer_id: opts.customerId ?? null,
    source: 'auto_pdf',
  });
  if (!res.ok) throw new Error(res.error || 'Ablage in AlixDocs fehlgeschlagen');
  return res.document_id!;
}

/** Signierte URL eines AlixDocs-Dokuments (bestehende Edge Function). */
export async function docSignedUrl(doc: DocRow): Promise<string> {
  const { data, error } = await supabase.functions.invoke('alixdocs-signed-url', {
    body: { document_id: doc.id, version_number: doc.current_version ?? 1 },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return (data as any).url as string;
}

export async function docBytes(doc: DocRow): Promise<Uint8Array> {
  const url = await docSignedUrl(doc);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Dokument konnte nicht geladen werden (HTTP ${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export function mergedFilename(orderNumber: string, customerName?: string | null) {
  const safe = (s: string) => s.replace(/[^\w\-.äöüÄÖÜß ]/g, '').trim().replace(/\s+/g, '_');
  return `ALIX_${safe(orderNumber || 'Auftrag')}_${safe(customerName || 'Kunde')}_Vertragsunterlagen.pdf`;
}

/** Führt SEPA + Mietkauf + Ratenplan in dieser Reihenfolge zu einer PDF zusammen. */
export async function mergePdfs(parts: Uint8Array[]): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const out = await PDFDocument.create();
  for (const part of parts) {
    const src = await PDFDocument.load(part, { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  const bytes = await out.save();
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
}
