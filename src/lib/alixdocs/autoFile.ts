import { supabase } from '@/integrations/supabase/client';

export type AlixDocsCategory =
  | 'angebot' | 'auftragsbestaetigung' | 'rechnung' | 'lieferschein' | 'kaufvertrag'
  | 'mietvertrag' | 'finanzierung' | 'servicebericht' | 'reparatur' | 'uebergabe'
  | 'geraetefoto' | 'mediapaket' | 'nisv' | 'schulung' | 'garantie' | 'sonstiges';

/**
 * Legt eine generierte PDF (oder Bild) automatisch in AlixDocs ab.
 * Wird von den PDF-Generatoren (Angebot/AB/Rechnung/Servicebericht/…) aufgerufen.
 * Fehler werden nur geloggt — der Haupt-Flow wird NIE unterbrochen.
 */
export async function autoFileToAlixDocs(input: {
  blob: Blob;
  filename: string;
  category: AlixDocsCategory;
  title?: string;
  order_id?: string | null;
  customer_id?: string | null;
  source?: 'auto_pdf' | 'signature' | 'zoho' | 'mail_attachment';
  confidentiality_level?: 'normal' | 'vertraulich' | 'streng_vertraulich';
}): Promise<{ ok: boolean; document_id?: string; error?: string }> {
  try {
    const b64 = await blobToBase64(input.blob);
    const { data, error } = await supabase.functions.invoke('alixdocs-autofile', {
      body: {
        content_base64: b64,
        filename: input.filename,
        mime_type: input.blob.type || 'application/pdf',
        order_id: input.order_id ?? null,
        customer_id: input.customer_id ?? null,
        category_code: input.category,
        title: input.title ?? null,
        source: input.source ?? 'auto_pdf',
        confidentiality_level: input.confidentiality_level ?? 'normal',
      },
    });
    if (error || (data as any)?.error) {
      console.warn('[AlixDocs auto-file] failed:', (data as any)?.error ?? error?.message);
      return { ok: false, error: (data as any)?.error ?? error?.message };
    }
    return { ok: true, document_id: (data as any)?.document_id };
  } catch (e: any) {
    console.warn('[AlixDocs auto-file] exception:', e?.message);
    return { ok: false, error: e?.message };
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.substring(s.indexOf(',') + 1));
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
