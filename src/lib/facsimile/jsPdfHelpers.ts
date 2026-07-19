import { applyFacsimileToPdf, type FacsimileDocType } from "./applyFacsimile";
import { autoFileToAlixDocs, type AlixDocsCategory } from "@/lib/alixdocs/autoFile";

/** Optionale Metadaten, damit die gestempelte PDF automatisch in AlixDocs abgelegt wird. */
export type AutoFileOpts = {
  order_id?: string | null;
  customer_id?: string | null;
  title?: string;
};

function docTypeToCategory(t: FacsimileDocType): AlixDocsCategory {
  switch (t) {
    case "invoice": return "rechnung";
    case "offer": return "angebot";
    case "order_confirmation": return "auftragsbestaetigung";
    case "service_report": return "servicebericht";
  }
}

async function maybeAutoFile(
  blob: Blob,
  docType: FacsimileDocType,
  filename: string,
  ref?: string,
  autoFile?: AutoFileOpts,
) {
  if (!autoFile || (!autoFile.order_id && !autoFile.customer_id)) return;
  // Fire-and-forget — darf den Haupt-Flow nie blockieren.
  autoFileToAlixDocs({
    blob,
    filename,
    category: docTypeToCategory(docType),
    title: autoFile.title ?? ref ?? filename,
    order_id: autoFile.order_id ?? null,
    customer_id: autoFile.customer_id ?? null,
    source: "auto_pdf",
  }).catch((e) => console.warn("[AlixDocs auto-file] skipped:", e?.message));
}

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
    return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  } catch (e) {
    console.warn("[facsimile] stamping failed, using original PDF:", e);
    return new Blob([ab], { type: "application/pdf" });
  }
}

/** Öffnet die gestempelte PDF in neuem Fenster (Ersatz für doc.output('bloburl') → open). */
export async function openStampedPdf(
  doc: any,
  docType: FacsimileDocType,
  ref?: string,
  autoFile?: AutoFileOpts,
) {
  const blob = await stampedPdfBlob(doc, docType, ref);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  void maybeAutoFile(blob, docType, `${ref ?? docType}.pdf`, ref, autoFile);
}

/** Lädt die gestempelte PDF herunter (Ersatz für doc.save(name)). */
export async function downloadStampedPdf(
  doc: any,
  docType: FacsimileDocType,
  filename: string,
  ref?: string,
  autoFile?: AutoFileOpts,
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
  void maybeAutoFile(blob, docType, filename, ref, autoFile);
}

/** Wandelt eine Blob-Response (z.B. schon fertige Zoho-Rechnung) in eine gestempelte um. */
export async function stampExistingPdfBlob(
  input: Blob,
  docType: FacsimileDocType,
  ref?: string,
  autoFile?: AutoFileOpts,
): Promise<Blob> {
  const ab = await input.arrayBuffer();
  let out: Blob;
  try {
    const { bytes } = await applyFacsimileToPdf(new Uint8Array(ab), docType, ref);
    out = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  } catch (e) {
    console.warn("[facsimile] stamping (blob) failed, using original:", e);
    out = input;
  }
  void maybeAutoFile(out, docType, `${ref ?? docType}.pdf`, ref, autoFile);
  return out;
}
