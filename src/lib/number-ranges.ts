import { supabase } from '@/integrations/supabase/client';

/**
 * Zentrale Nummernkreis-Vergabe.
 *
 * Ruft die RPC `next_document_number(code, case_number)` auf. Liefert die RPC
 * `NULL` (Kreis inaktiv oder nicht vorhanden), wird die Fallback-Funktion
 * verwendet, sodass bestehende Legacy-Logik weiterläuft.
 *
 * Wird `caseNumber` übergeben und der Kreis ist auf „An Vorgangsnummer
 * koppeln" gesetzt, liefert die RPC die Dokumentnummer als
 * `prefix-<caseNumber>` (Suffix-Modus) und erhöht den eigenen Zähler nicht.
 */
export async function nextNumber(
  code: string,
  fallback: () => string,
  opts?: { caseNumber?: string | null },
): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('next_document_number', {
      p_code: code,
      p_case_number: opts?.caseNumber ?? null,
    } as any);
    if (error) {
      console.warn('[number-ranges] next_document_number failed', code, error.message);
      return fallback();
    }
    const value = (data as unknown as string | null) ?? null;
    if (value && typeof value === 'string' && value.length > 0) return value;
    return fallback();
  } catch (e) {
    console.warn('[number-ranges] next_document_number exception', code, e);
    return fallback();
  }
}

/** Bequemer Alias mit benannten Optionen. */
export const nextDocumentNumber = nextNumber;

/**
 * Liefert die Stammnummer eines Vorgangs. Existiert bereits eine, wird sie
 * zurückgegeben. Andernfalls wird über die RPC `next_case_number()` eine
 * neue gezogen. Ist der Master-Kreis `case` deaktiviert, gibt die Funktion
 * `null` zurück – dann läuft das System wie bisher mit unabhängigen Zählern.
 */
export async function ensureCaseNumber(existing?: string | null): Promise<string | null> {
  if (existing && existing.trim().length > 0) return existing;
  try {
    const { data, error } = await supabase.rpc('next_case_number' as any);
    if (error) {
      console.warn('[number-ranges] next_case_number failed', error.message);
      return null;
    }
    return (data as unknown as string | null) || null;
  } catch (e) {
    console.warn('[number-ranges] next_case_number exception', e);
    return null;
  }
}

/**
 * Vorschau ohne Increment (für UI-Anzeige der "nächsten" Nummer).
 */
export async function peekNumber(code: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('peek_document_number', { p_code: code } as any);
    if (error) return null;
    return (data as unknown as string | null) ?? null;
  } catch {
    return null;
  }
}

/** Reine Format-Vorschau im Browser für die Admin-Seite. */
export function formatDocumentNumberPreview(opts: {
  prefix: string;
  separator?: string;
  include_year?: boolean;
  padding?: number;
  value?: number;
  year?: number;
}): string {
  const sep = opts.separator ?? '-';
  const year = opts.year ?? new Date().getFullYear();
  const padding = Math.max(1, opts.padding ?? 5);
  const value = String(opts.value ?? 1).padStart(padding, '0');
  const head = opts.prefix ? `${opts.prefix}${sep}` : '';
  const yr = opts.include_year ? `${year}${sep}` : '';
  return `${head}${yr}${value}`;
}

/** Vorschau für Suffix-Modus (an Vorgangsnummer koppeln). */
export function formatCaseSuffixPreview(prefix: string, separator: string, caseExample = '2026-04217'): string {
  if (!prefix) return caseExample;
  return `${prefix}${separator || '-'}${caseExample}`;
}
