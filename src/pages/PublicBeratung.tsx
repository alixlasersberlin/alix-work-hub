import { useEffect } from 'react';
import SalesWizard from '@/components/SalesWizard';
import WizardLanguageSwitcher from '@/components/WizardLanguageSwitcher';

export default function PublicBeratung() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isEmbed = params?.get('embed') === '1' || params?.get('embed') === 'true';

  useEffect(() => {
    try {
      localStorage.setItem('alixwork.ui_template', 'standard');
    } catch {
      /* ignore */
    }
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    const hadLight = root.classList.contains('light');
    root.classList.remove('theme-neo', 'light');
    root.classList.add('dark');
    root.setAttribute('data-lock-template', 'standard');
    if (isEmbed) {
      root.style.background = 'transparent';
      document.body.style.background = 'transparent';
    }
    return () => {
      root.removeAttribute('data-lock-template');
      if (!hadDark) root.classList.remove('dark');
      if (hadLight) root.classList.add('light');
      if (isEmbed) {
        root.style.background = '';
        document.body.style.background = '';
      }
    };
  }, [isEmbed]);

  if (isEmbed) {
    return (
      <div className="min-h-screen p-2 sm:p-4 bg-transparent">
        <SalesWizard publicMode={false} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(120%_120%_at_0%_0%,rgba(34,211,238,0.18),transparent_55%),radial-gradient(120%_120%_at_100%_100%,rgba(217,70,239,0.18),transparent_55%),linear-gradient(160deg,#05070f_0%,#0a0f24_50%,#070b1a_100%)] text-white">
      {/* Ambient AI orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-20 h-[18rem] w-[18rem] sm:h-[28rem] sm:w-[28rem] rounded-full bg-cyan-400/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-20 h-[20rem] w-[20rem] sm:h-[32rem] sm:w-[32rem] rounded-full bg-fuchsia-500/20 blur-3xl animate-pulse [animation-delay:1s]" />
      </div>
      {/* Grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30 bg-[linear-gradient(transparent_95%,rgba(255,255,255,0.05)_95%),linear-gradient(90deg,transparent_95%,rgba(255,255,255,0.05)_95%)] bg-[size:42px_42px]"
      />

      {/* Header */}
      <header className="relative z-30 flex items-center justify-between gap-3 px-4 sm:px-6 py-4 sm:py-6">
        <div className="text-base sm:text-2xl font-bold tracking-[0.18em] truncate">
          Alix Lasers ®
        </div>
        <div className="hidden md:block text-xs text-blue-100/70 shrink-0">
          100% AI Full Technologie
        </div>
      </header>

      <main className="relative z-20 pb-12 px-2 sm:px-4">
        <SalesWizard publicMode={false} />
      </main>
    </div>
  );
}
