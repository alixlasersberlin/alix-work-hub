import { useEffect } from 'react';
import BookingPortal from './BookingPortal';

/**
 * Alix-Lasers-Design-Variante des öffentlichen Buchungsportals (/book-alix).
 * Rein visuelle Kopie im Look von alix-lasers.de (Weiß / Alix-Blau, feine Typografie).
 * Die Originalseiten /book und /book-creme bleiben unverändert.
 */
export default function BookingPortalAlix() {
  useEffect(() => {
    const html = document.documentElement;
    const prevTheme = html.getAttribute('data-theme');
    const hadDark = html.classList.contains('dark');
    const prevAurora = html.getAttribute('data-aurora');

    html.setAttribute('data-public-wizard', '1');
    html.setAttribute('data-booking-alix', '1');
    html.removeAttribute('data-aurora');
    html.classList.remove('dark');
    html.classList.add('light');
    html.setAttribute('data-theme', 'light');

    return () => {
      html.removeAttribute('data-public-wizard');
      html.removeAttribute('data-booking-alix');
      if (prevAurora) html.setAttribute('data-aurora', prevAurora);
      if (hadDark) {
        html.classList.remove('light');
        html.classList.add('dark');
      }
      if (prevTheme) html.setAttribute('data-theme', prevTheme);
    };
  }, []);

  return (
    <div className="theme-alix min-h-dvh">
      <BookingPortal />
    </div>
  );
}
