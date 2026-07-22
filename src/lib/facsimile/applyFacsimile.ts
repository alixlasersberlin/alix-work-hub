import { supabase } from "@/integrations/supabase/client";

export type FacsimileDocType =
  | "invoice"
  | "offer"
  | "order_confirmation"
  | "service_report"
  | "lease_purchase";

/**
 * Sendet ein PDF an die Edge Function und erhält ein PDF mit eingebetteter
 * Facsimile-Unterschrift zurück (falls für diesen Dokumenttyp konfiguriert & aktiv).
 * Bei nicht aktiver Konfiguration wird das Original unverändert zurückgegeben.
 */
export async function applyFacsimileToPdf(
  pdfBytes: Uint8Array | ArrayBuffer,
  docType: FacsimileDocType,
  documentRef?: string,
): Promise<{ bytes: Uint8Array; applied: boolean; signerName?: string }> {
  const src = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const b64 = uint8ToBase64(src);

  const { data, error } = await supabase.functions.invoke("sig-apply-facsimile", {
    body: { pdf_base64: b64, doc_type: docType, document_ref: documentRef },
  });
  if (error) throw error;
  const out = data as { pdf_base64: string; applied: boolean; signer_name?: string };
  return {
    bytes: base64ToUint8(out.pdf_base64),
    applied: !!out.applied,
    signerName: out.signer_name,
  };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
