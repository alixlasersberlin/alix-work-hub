import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { ArrowRight, CalendarCheck, Clock, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { DEFAULT_BOOKING_SETTINGS, generateSlots, nextAvailableDays } from '@/lib/esc/booking-settings';
import alixLogo from '@/assets/alix-logo-gold.png';
import BookingPortal from './BookingPortal';

/** Echter Mini-Terminplaner im Hero: reale Verfügbarkeiten, Vorauswahl fürs Portal. */
function HeroScheduler({ onConfirm }: { onConfirm: () => void }) {
  const { appointments } = useAppointments();
  const days = useMemo(() => nextAvailableDays(new Date(), 10, DEFAULT_BOOKING_SETTINGS).slice(0, 6), []);
  const [dayIso, setDayIso] = useState<string>(() => days[0]?.toISOString() ?? '');
  const [slotIso, setSlotIso] = useState<string>('');

  const slots = useMemo(() => {
    if (!dayIso) return [];
    return generateSlots(new Date(dayIso), 30, appointments, DEFAULT_BOOKING_SETTINGS).slice(0, 8);
  }, [dayIso, appointments]);

  const confirm = () => {
    if (!slotIso) return;
    sessionStorage.setItem('alix-book-prefill', JSON.stringify({ dayIso, slotIso }));
    toast.success(`Termin vorgemerkt: ${format(new Date(slotIso), "EEEE, dd.MM. · HH:mm", { locale: de })} Uhr`);
    onConfirm();
  };

  return (
    <div className="alix-planner">
      <div className="alix-planner-head">
        <CalendarCheck className="w-4 h-4" aria-hidden />
        <span>Terminplaner</span>
      </div>

      <div className="alix-planner-days">
        {days.map((d) => {
          const iso = d.toISOString();
          const active = iso === dayIso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => { setDayIso(iso); setSlotIso(''); }}
              className={`alix-day${active ? ' is-active' : ''}`}
              aria-pressed={active}
            >
              <span className="alix-day-wd">{format(d, 'EEE', { locale: de })}</span>
              <span className="alix-day-num">{format(d, 'dd')}</span>
              <span className="alix-day-mo">{format(d, 'MMM', { locale: de })}</span>
            </button>
          );
        })}
      </div>

      <div className="alix-planner-label">
        <Clock className="w-3.5 h-3.5" aria-hidden />
        Freie Zeiten
      </div>

      {slots.length === 0 ? (
        <p className="alix-planner-empty">An diesem Tag sind keine Zeiten mehr frei – bitte anderen Tag wählen.</p>
      ) : (
        <div className="alix-planner-slots">
          {slots.map((s) => {
            const iso = s.toISOString();
            const active = iso === slotIso;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSlotIso(iso)}
                className={`alix-slot${active ? ' is-active' : ''}`}
                aria-pressed={active}
              >
                {format(s, 'HH:mm')}
              </button>
            );
          })}
        </div>
      )}

      <button type="button" onClick={confirm} disabled={!slotIso} className="alix-planner-cta">
        {slotIso ? `Weiter mit ${format(new Date(slotIso), 'HH:mm')} Uhr` : 'Zeit auswählen'}
        <ArrowRight className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}


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
          <div className="alix-hero-inner mx-auto w-full max-w-6xl px-5 py-14 sm:py-20 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="text-center lg:text-left">
              <img src={alixLogo} alt="Alix Lasers" className="alix-hero-logo" width={320} height={96} />
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

            <HeroScheduler onConfirm={scrollToPortal} />
          </div>
        </section>
      )}

      <div id="book-alix-portal" className="scroll-mt-4">
        <BookingPortal />
      </div>
    </div>
  );
}


