/**
 * Additive Capture-Schicht für den geführten Dokumentenprozess.
 * Bestehende Generatoren (SEPA / Mietkauf / Ratenplan) bleiben unverändert –
 * sie melden lediglich optional die erzeugte PDF, wenn ein Listener aktiv ist.
 */
export type OrderDocKind = 'sepa' | 'mietkauf' | 'ratenplan';

type Listener = (kind: OrderDocKind, blob: Blob, filename: string) => void;

let listener: Listener | null = null;

export function onPdfCapture(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function isCaptureActive() {
  return listener !== null;
}

/** Wird von den bestehenden PDF-Generatoren aufgerufen (no-op ohne aktiven Listener). */
export function capturePdf(kind: OrderDocKind, makeBlob: () => Blob, filename: string) {
  if (!listener) return;
  try {
    listener(kind, makeBlob(), filename);
  } catch (e) {
    console.warn('[order-docs] capture failed', kind, e);
  }
}
