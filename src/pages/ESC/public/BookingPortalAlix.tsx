import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowRight, CalendarCheck, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import BookingPortal from './BookingPortal';

/**
 * Alix-Lasers-Design-Variante des öffentlichen Buchungsportals (/book-alix).
 * Dunkles Premium-Design mit Cursor-Spotlight und Scroll-Reveal.
 * Die Originalseiten /book und /book-creme bleiben unverändert.
 */
export default function BookingPortalAlix() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { department, service } = useParams();
  const showHero = !department && !service;


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

  // Cursor-Spotlight
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        el.style.setProperty('--mx', `${e.clientX}px`);
        el.style.setProperty('--my', `${e.clientY}px`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Scroll-Reveal für Kacheln/Karten (auch bei Navigation im Wizard)
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.reveal = 'in';
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );

    const scan = () => {
      el.querySelectorAll<HTMLElement>('.book-tile, [data-slot="card"]').forEach((node, i) => {
        if (node.dataset.reveal) return;
        node.dataset.reveal = 'out';
        node.style.transitionDelay = `${Math.min(i, 10) * 45}ms`;
        io.observe(node);
      });
    };

    scan();
    const mo = new MutationObserver(() => scan());
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  const scrollToPortal = () => {
    const target = rootRef.current?.querySelector('#book-alix-portal');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div ref={rootRef} className="theme-alix min-h-dvh">
      {showHero && (
        <section className="alix-hero">
          <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:py-20 text-center">
            <span className="alix-hero-eyebrow">
              <Sparkles className="w-3.5 h-3.5" aria-hidden />
              Alix Lasers · Service &amp; Beratung
            </span>
            <h1 className="alix-hero-title">Ihr Termin bei Alix – in unter 60 Sekunden gebucht</h1>
            <p className="alix-hero-sub">
              Beratung, Technik-Support, Angebote und Auftragsstatus: Wählen Sie Ihr Anliegen und
              erhalten Sie sofort eine Bestätigung – persönlich betreut von unserem Team.
            </p>
            <div className="alix-hero-cta">
              <button type="button" onClick={scrollToPortal} className="alix-btn-primary">
                <CalendarCheck className="w-[18px] h-[18px]" aria-hidden />
                Termin jetzt buchen
                <ArrowRight className="w-4 h-4 alix-btn-arrow" aria-hidden />
              </button>
              <a
                href="https://wa.me/491711651000"
                target="_blank"
                rel="noopener noreferrer"
                className="alix-btn-secondary"
              >
                <MessageCircle className="w-[18px] h-[18px]" aria-hidden />
                Direkt per WhatsApp
              </a>
            </div>
            <p className="alix-hero-trust">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
              Kostenlos &amp; unverbindlich · Antwort meist innerhalb weniger Minuten
            </p>
          </div>
        </section>
      )}
      <div id="book-alix-portal" className="scroll-mt-4">
        <BookingPortal />
      </div>
    </div>
  );
}


