import { useEffect } from 'react';
import SalesWizard from '@/components/SalesWizard';
import bgAsset from '@/assets/wizard/alix-lasers-bg.jpg.asset.json';

export default function PublicBeratung() {
  // Embed-Modus: /beratung?embed=1 → transparenter Hintergrund, kein Vollbild-Bild,
  // damit das Formular nahtlos auf fremden Webseiten per <iframe> eingebettet werden kann.
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isEmbed = params?.get('embed') === '1' || params?.get('embed') === 'true';

  // Force Standard template on the public beratung page; lock out switcher.
  useEffect(() => {
    try {
      localStorage.setItem('alixwork.ui_template', 'standard');
    } catch {
      /* ignore */
    }
    document.documentElement.classList.remove('theme-neo');
    document.documentElement.setAttribute('data-lock-template', 'standard');
    if (isEmbed) {
      // Transparenter Body, damit die Hintergrundfarbe der Parent-Seite durchscheint.
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
    }
    return () => {
      document.documentElement.removeAttribute('data-lock-template');
      if (isEmbed) {
        document.documentElement.style.background = '';
        document.body.style.background = '';
      }
    };
  }, [isEmbed]);

  if (isEmbed) {
    return (
      <div className="min-h-screen p-2 sm:p-4 bg-transparent">
        <SalesWizard publicMode />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-6 bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: `url(${bgAsset.url})` }}
    >
      <SalesWizard publicMode />
    </div>
  );
}

