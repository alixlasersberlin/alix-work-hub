import { useEffect } from 'react';
import PremiumSalesWizard from '@/components/PremiumSalesWizard';

/** Öffentliche ALIX Premium Beratung (/beratung/premium). Bestehende /beratung bleibt unverändert. */
export default function PublicBeratungPremium() {
  useEffect(() => {
    document.documentElement.setAttribute('data-lock-template', 'premium');
    return () => document.documentElement.removeAttribute('data-lock-template');
  }, []);

  return <PremiumSalesWizard publicMode />;
}
