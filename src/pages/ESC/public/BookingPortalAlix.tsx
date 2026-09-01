import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { MessageCircle, ArrowRight, Clock } from 'lucide-react';
import BookingPortal from './BookingPortal';

const WA_NUMBER = '491711651000';

/**
 * Alix-Lasers-Design-Variante des öffentlichen Buchungsportals (/book-alix).
 * Dunkles Premium-Design mit Cursor-Spotlight und Scroll-Reveal.
 * Die Originalseiten /book und /book-creme bleiben unverändert.
 */
export default function BookingPortalAlix() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { department, service } = useParams();
  const showWa = !department && !service;

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

  return (
    <div ref={rootRef} className="theme-alix min-h-dvh">
      {showWa && (
        <section className="alix-wa-wrap">
          <div className="alix-wa-card">
            <span className="alix-wa-eyebrow">
              <MessageCircle className="w-3.5 h-3.5" aria-hidden />
              Verkauf
            </span>
            <h2 className="alix-wa-title">Direkt mit dem Verkauf per WhatsApp</h2>
            <p className="alix-wa-sub">
              Angebote, Preise, Verfügbarkeiten und Beratung – schreiben Sie uns direkt. Wir
              antworten meist innerhalb weniger Minuten.
            </p>
            <a
              href={`https://wa.me/${WA_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="alix-wa-cta"
            >
              <MessageCircle className="w-[18px] h-[18px]" aria-hidden />
              +49 171 1651000
              <ArrowRight className="w-4 h-4" aria-hidden />
            </a>
            <p className="alix-wa-hint">
              <Clock className="w-3.5 h-3.5" aria-hidden />
              Mo–Fr 08:00–17:00 Uhr · kostenlos &amp; unverbindlich
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
