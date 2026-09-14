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
