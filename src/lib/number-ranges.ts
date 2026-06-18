import { supabase } from '@/integrations/supabase/client';

/**
 * Zentrale Nummernkreis-Vergabe.
 *
 * Ruft die RPC `next_document_number(code)` auf. Liefert die RPC `NULL`
 * (Kreis inaktiv oder nicht vorhanden), wird die Fallback-Funktion
 * verwendet, sodass bestehende Legacy-Logik weiterläuft.
 */
export async function nextNumber(code: string, fallback: () => string): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('next_document_number', { p_code: code } as any);
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
