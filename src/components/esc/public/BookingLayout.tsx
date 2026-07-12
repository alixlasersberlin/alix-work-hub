import { ReactNode, useEffect } from 'react';
import { Link } from 'react-router-dom';
import alixLogo from '@/assets/alix-logo-gold.png';
import { ALIXWORKS_PUBLIC_BASE } from '@/lib/esc/public-url';
import WizardLanguageSwitcher from '@/components/WizardLanguageSwitcher';
import { useBookingT } from '@/i18n/booking';

interface Props {
  children: ReactNode;
  step?: number;
  totalSteps?: number;
  narrow?: boolean;
  hideLegalLinks?: boolean;
}

export function BookingLayout({ children, step, totalSteps, narrow, hideLegalLinks }: Props) {
  const { t, lang } = useBookingT();
  const progress = step && totalSteps ? Math.round((step / totalSteps) * 100) : 0;

  // Setzt Dokumentrichtung + Sprach-Attribut nur solange dieser Layout gemountet ist.
  useEffect(() => {
    const html = document.documentElement;
    const prevDir = html.getAttribute('dir');
    const prevLang = html.getAttribute('lang');
    html.setAttribute('dir', t.dir);
    html.setAttribute('lang', lang);
    return () => {
      if (prevDir) html.setAttribute('dir', prevDir); else html.removeAttribute('dir');
      if (prevLang) html.setAttribute('lang', prevLang); else html.removeAttribute('lang');
    };
  }, [t.dir, lang]);

  return (
    <div dir={t.dir} className="min-h-dvh flex flex-col bg-gradient-to-b from-background via-background to-muted/30 text-foreground">
      <header className="border-b bg-card/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 py-3">
          <img src={alixLogo} alt="Alix Smart" className="h-9 w-auto" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-normal tracking-tight truncate">{t.brand_line}</div>
          </div>
          <WizardLanguageSwitcher variant="transparent" />
        </div>

        {step && totalSteps && (
          <div className="max-w-5xl mx-auto px-4 pb-2">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-[10.5px] text-muted-foreground mt-1">{t.step_of(step, totalSteps)}</div>
          </div>
        )}
      </header>

      <main className={`flex-1 w-full mx-auto p-4 md:p-6 space-y-4 ${narrow ? 'max-w-2xl' : 'max-w-5xl'}`}>
        {children}
      </main>

      <footer className="border-t bg-card/40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>© {new Date().getFullYear()} Alix Lasers · AlixWorks</span>
          {!hideLegalLinks && (
            <>
              <a href={`${ALIXWORKS_PUBLIC_BASE}/impressum`} className="hover:text-primary">Impressum</a>
              <a href={`${ALIXWORKS_PUBLIC_BASE}/datenschutz`} className="hover:text-primary">Datenschutz</a>
              <a href={`${ALIXWORKS_PUBLIC_BASE}/agb`} className="hover:text-primary">AGB</a>
              <Link to="/book" className="hover:text-primary ms-auto">{t.thanks.again}</Link>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
