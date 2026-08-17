import { useEffect } from 'react';
import PremiumSalesWizard from '@/components/PremiumSalesWizard';

/** Öffentliche ALIX Premium Beratung (/beratung/premium). Bestehende /beratung bleibt unverändert. */
export default function PublicBeratungPremium() {
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


  return <PremiumSalesWizard publicMode />;
}
