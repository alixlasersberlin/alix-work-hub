// "Schulung VIP" – Terminart mit grüner Hervorhebung im Teamkalender.
export const VIP_TRAINING_KIND = 'Schulung VIP';
export const VIP_TRAINING_COLOR = '#22c55e';

/** Erkennt VIP-Schulungen anhand der Terminart oder des Titels. */
export function isVipTraining(a?: { kind?: string | null; title?: string | null } | null): boolean {
  const s = `${a?.kind ?? ''} ${a?.title ?? ''}`.toLowerCase();
  return s.includes('schulung vip') || (s.includes('vip') && s.includes('schulung'));
}

/** Tailwind-Klassen für grün hinterlegte VIP-Schulungstermine. */
export const VIP_TRAINING_CLASSES = 'bg-emerald-500/20 border-emerald-500/60 text-emerald-50';
