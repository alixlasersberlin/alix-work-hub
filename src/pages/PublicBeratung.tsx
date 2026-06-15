import { useEffect } from 'react';
import SalesWizard from '@/components/SalesWizard';

export default function PublicBeratung() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isEmbed = params?.get('embed') === '1' || params?.get('embed') === 'true';

  useEffect(() => {
    try {
      localStorage.setItem('alixwork.ui_template', 'standard');
    } catch {
      /* ignore */
    }
    document.documentElement.classList.remove('theme-neo');
    document.documentElement.setAttribute('data-lock-template', 'standard');
    if (isEmbed) {
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
    <div className="relative min-h-screen overflow-hidden p-4 sm:p-6 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(34,211,238,0.18),transparent_55%),radial-gradient(120%_120%_at_100%_100%,rgba(217,70,239,0.18),transparent_55%),linear-gradient(160deg,#05070f_0%,#0a0f24_50%,#070b1a_100%)]">
      {/* Ambient AI orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-[20rem] w-[20rem] sm:h-[28rem] sm:w-[28rem] rounded-full bg-cyan-400/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-24 h-[24rem] w-[24rem] sm:h-[32rem] sm:w-[32rem] rounded-full bg-fuchsia-500/20 blur-3xl animate-pulse [animation-delay:1s]" />
        <div className="absolute top-1/3 left-1/2 h-56 w-56 sm:h-72 sm:w-72 -translate-x-1/2 rounded-full bg-amber-300/10 blur-3xl animate-pulse [animation-delay:2s]" />
      </div>
      {/* Grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 bg-[linear-gradient(transparent_95%,rgba(255,255,255,0.05)_95%),linear-gradient(90deg,transparent_95%,rgba(255,255,255,0.05)_95%)] bg-[size:42px_42px]"
      />
      {/* Watermark */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center select-none opacity-[0.04]">
        <div className="text-[28vw] sm:text-[18vw] font-black tracking-tighter text-white whitespace-nowrap">ALIX</div>
      </div>

      <div className="relative z-10">
        <SalesWizard publicMode />
      </div>
    </div>
  );
}
