/**
 * ALIXWORK MOBILE – Haptik (Prompt 8).
 *
 * Reine UI-Schicht: nutzt Capacitor Haptics, wenn ein nativer Build vorhanden
 * ist, sonst die Web-Vibration-API. Ohne Unterstützung passiert bewusst nichts
 * (kein Fehler, kein Fallback-Sound). Keine Backend-Abhängigkeit.
 */

export type HapticKind = 'light' | 'medium' | 'success' | 'warning' | 'error' | 'priority';

const PATTERN: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 18,
  success: [12, 40, 22],
  warning: [16, 60, 16],
  error: [24, 50, 24, 50, 24],
  priority: [30, 70, 30],
};

function reducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** Gibt haptisches Feedback, sofern das Gerät es unterstützt. */
export function haptic(kind: HapticKind = 'light'): void {
  try {
    // Nativer Capacitor-Build (falls vorhanden) – dynamisch, ohne harte Abhängigkeit.
    const cap = (globalThis as any).Capacitor;
    const plugin = cap?.Plugins?.Haptics;
    if (plugin) {
      if (kind === 'success' || kind === 'warning' || kind === 'error') {
        plugin.notification?.({ type: kind.toUpperCase() });
      } else if (kind === 'priority') {
        plugin.impact?.({ style: 'HEAVY' });
      } else {
        plugin.impact?.({ style: kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
      }
      return;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      // Bei "Bewegung reduzieren" nur die kürzeste Rückmeldung.
      navigator.vibrate(reducedMotion() ? 8 : PATTERN[kind]);
    }
  } catch {
    /* Haptik ist optional – niemals blockierend. */
  }
}

/** true, wenn das System weniger Animation wünscht. */
export const prefersReducedMotion = reducedMotion;
