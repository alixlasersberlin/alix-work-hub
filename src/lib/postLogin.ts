/**
 * Post-Login-Steuerung: Nach jedem erfolgreichen Login wird die
 * Willkommens-Seite (/willkommen) erzwungen – unabhängig davon, über
 * welchen Login-Alias oder MFA-Schritt der Nutzer hereinkommt.
 */
const KEY = 'alix_force_welcome';

export function postLoginTarget(): string {
  if (typeof window !== 'undefined' && window.location.hostname === 'app.alixwork.de') {
    return '/esc/kalender';
  }
  return '/willkommen';
}

export function markPostLogin() {
  try {
    if (postLoginTarget() === '/willkommen') sessionStorage.setItem(KEY, '1');
  } catch { /* ignore */ }
}

export function hasPendingWelcome(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function clearPendingWelcome() {
  try {
    sessionStorage.removeItem(KEY);
  } catch { /* ignore */ }
}
