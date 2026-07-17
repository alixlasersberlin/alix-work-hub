import { applyFacsimileToPdf, type FacsimileDocType } from "./applyFacsimile";

/**
 * Nimmt ein jsPDF-Dokument, jagt es durch die Facsimile-Edge-Function
 * und gibt einen Blob zurück (fällt bei Fehler auf das Original zurück).
 */
export async function stampedPdfBlob(
  doc: any,
  docType: FacsimileDocType,
  ref?: string,
): Promise<Blob> {
  const ab = doc.output("arraybuffer") as ArrayBuffer;
  try {
    const { bytes } = await applyFacsimileToPdf(new Uint8Array(ab), docType, ref);
    return new Blob([bytes], { type: "application/pdf" });
  } catch (e) {
    console.warn("[facsimile] stamping failed, using original PDF:", e);
    return new Blob([ab], { type: "application/pdf" });
  }
}

/** Öffnet die gestempelte PDF in neuem Fenster (Ersatz für doc.output('bloburl') → open). */
export async function openStampedPdf(doc: any, docType: FacsimileDocType, ref?: string) {
  const blob = await stampedPdfBlob(doc, docType, ref);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Lädt die gestempelte PDF herunter (Ersatz für doc.save(name)). */
export async function downloadStampedPdf(
  doc: any,
  docType: FacsimileDocType,
  filename: string,
  ref?: string,
) {
  const blob = await stampedPdfBlob(doc, docType, ref);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Wandelt eine Blob-Response (z.B. schon fertige Zoho-Rechnung) in eine gestempelte um. */
export async function stampExistingPdfBlob(
  input: Blob,
  docType: FacsimileDocType,
  ref?: string,
): Promise<Blob> {
  const ab = await input.arrayBuffer();
  try {
    const { bytes } = await applyFacsimileToPdf(new Uint8Array(ab), docType, ref);
    return new Blob([bytes], { type: "application/pdf" });
  } catch (e) {
    console.warn("[facsimile] stamping (blob) failed, using original:", e);
    return input;
  }
}
