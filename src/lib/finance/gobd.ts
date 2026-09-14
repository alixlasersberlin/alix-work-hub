import { supabase } from '@/integrations/supabase/client';

/** Erkennt eine serverseitige GoBD-Sperre (finalisierte Rechnung / gesperrte Periode). */
export function isGobdLockError(message?: string | null): boolean {
  return !!message && message.includes('GoBD:');
}

/** Klartext für den Anwender. */
export function gobdLockMessage(message?: string | null): string {
  if (!message) return 'Änderung wurde abgelehnt.';
  return message.replace(/^.*GoBD:\s*/, '').trim();
}

/**
 * Protokolliert einen abgewiesenen Änderungsversuch an einer fertigen Rechnung.
 * Darf die Oberfläche nie blockieren.
 */
export async function logInvoiceChangeRejected(params: {
  invoiceId: string;
  fields?: string[];
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await (supabase as any).rpc('gobd_log_invoice_event', {
      _invoice_id: params.invoiceId,
      _action: 'INVOICE_CHANGE_REJECTED',
      _reason: params.reason ?? null,
      _related_invoice_id: null,
      _fields: params.fields ?? null,
      _metadata: (params.metadata ?? {}) as any,
    });
  } catch {
    /* Protokollierung darf nie blockieren */
  }
}

/** Legt eine Storno-/Gutschrift-/Berichtigungsverknüpfung zur Originalrechnung an. */
export async function createInvoiceCorrection(params: {
  originalInvoiceId: string;
  type: 'storno' | 'gutschrift' | 'berichtigung';
  reason: string;
  correctionInvoiceId?: string | null;
}) {
  const { data, error } = await (supabase as any).rpc('create_invoice_correction', {
    _original_invoice_id: params.originalInvoiceId,
    _correction_type: params.type,
    _reason: params.reason,
    _correction_invoice_id: params.correctionInvoiceId ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

async function sha256Hex(content: string): Promise<string | null> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/**
 * Nachweis für einen steuerlich relevanten Export (DATEV, Steuer, Bank, Journal …).
 * Darf die Oberfläche nie blockieren.
 */
export async function logGobdExport(params: {
  exportType: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  recordCount?: number | null;
  fileName?: string | null;
  content?: string | null;
  status?: 'CREATED' | 'DOWNLOADED' | 'FAILED';
  region?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const hash = params.content ? await sha256Hex(params.content) : null;
    await (supabase as any).rpc('gobd_log_export', {
      _export_type: params.exportType,
      _period_from: params.periodFrom ?? null,
      _period_to: params.periodTo ?? null,
      _record_count: params.recordCount ?? null,
      _file_name: params.fileName ?? null,
      _file_hash: hash,
      _status: params.status ?? 'CREATED',
      _accounting_region: params.region ?? null,
      _tenant_id: null,
      _metadata: (params.metadata ?? {}) as any,
    });
  } catch {
    /* Protokollierung darf nie blockieren */
  }
}
