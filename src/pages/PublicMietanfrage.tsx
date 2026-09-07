import { useEffect } from 'react';
import PremiumRentalWizard from '@/components/PremiumRentalWizard';

/** Öffentliche ALIX Premium Mietanfrage (/miete/premium). */
export default function PublicMietanfrage() {
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-lock-template', 'premium');
    html.setAttribute('data-public-wizard', '1');
    const hadAurora = html.getAttribute('data-aurora');
    html.removeAttribute('data-aurora');
    return () => {
      html.removeAttribute('data-lock-template');
      html.removeAttribute('data-public-wizard');
      if (hadAurora) html.setAttribute('data-aurora', hadAurora);
    };
  }, []);

  return <PremiumRentalWizard />;
}
