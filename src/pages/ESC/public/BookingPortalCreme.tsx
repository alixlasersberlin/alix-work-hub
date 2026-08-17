import { useEffect } from 'react';
import BookingPortal from './BookingPortal';

/**
 * Creme-Variante des öffentlichen Buchungsportals (/book-creme).
 * Rein visuelle Kopie für die Einbindung auf alix-lasers.de.
 * Die blaue Originalseite unter /book bleibt unverändert.
 */
export default function BookingPortalCreme() {
  useEffect(() => {
    const html = document.documentElement;
    const prevTheme = html.getAttribute('data-theme');
    const hadDark = html.classList.contains('dark');
    const prevAurora = html.getAttribute('data-aurora');

    html.setAttribute('data-public-wizard', '1');
    html.setAttribute('data-booking-creme', '1');
    html.removeAttribute('data-aurora');
    html.classList.remove('dark');
    html.classList.add('light');
    html.setAttribute('data-theme', 'light');

    return () => {
      html.removeAttribute('data-public-wizard');
      html.removeAttribute('data-booking-creme');
      if (prevAurora) html.setAttribute('data-aurora', prevAurora);
      if (hadDark) {
        html.classList.remove('light');
        html.classList.add('dark');
      }
      if (prevTheme) html.setAttribute('data-theme', prevTheme);
    };
  }, []);

  return (
    <div className="theme-creme min-h-dvh">
      <BookingPortal />
    </div>
  );
}
