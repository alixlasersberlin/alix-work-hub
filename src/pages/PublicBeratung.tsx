import { useEffect } from 'react';
import SalesWizard from '@/components/SalesWizard';
import bgAsset from '@/assets/wizard/alix-lasers-bg.jpg.asset.json';

export default function PublicBeratung() {
  // Force Standard template on the public beratung page; lock out switcher.
  useEffect(() => {
    try {
      localStorage.setItem('alixwork.ui_template', 'standard');
    } catch {
      /* ignore */
    }
    document.documentElement.classList.remove('theme-neo');
    document.documentElement.setAttribute('data-lock-template', 'standard');
    return () => {
      document.documentElement.removeAttribute('data-lock-template');
    };
  }, []);

  return (
    <div
      className="min-h-screen p-6 bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: `url(${bgAsset.url})` }}
    >
      <SalesWizard publicMode />
    </div>
  );
}
