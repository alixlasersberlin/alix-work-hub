import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessageCircle, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const RAW = '+491711651000';
const PRETTY = '+49 171 1651000';
const WA_LINK = `https://wa.me/491711651000?text=${encodeURIComponent('Hallo Alix Lasers, ich habe eine Verkaufsanfrage.')}`;

export default function Verkauf() {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);

  // Ziffern-Typewriter für die Hotline
  useEffect(() => {
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(PRETTY.slice(0, i));
      if (i >= PRETTY.length) window.clearInterval(id);
    }, 55);
    return () => window.clearInterval(id);
  }, []);

  // Cursor-Spotlight auf der Karte
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--sx', `${e.clientX - r.left}px`);
      el.style.setProperty('--sy', `${e.clientY - r.top}px`);
    };
    el.addEventListener('pointermove', onMove);
    return () => el.removeEventListener('pointermove', onMove);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(RAW);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 sm:p-8">
      <section className="w-full max-w-xl animate-fade-in">
        <div
          ref={cardRef}
          className="group relative overflow-hidden rounded-3xl border border-primary/40 bg-card/60 backdrop-blur shadow-[0_0_40px_-12px_hsl(var(--primary)/0.6)] p-6 sm:p-10 text-center"
          style={{ ['--sx' as string]: '50%', ['--sy' as string]: '0%' }}
        >
          {/* Spotlight */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              background:
                'radial-gradient(320px circle at var(--sx) var(--sy), hsl(var(--primary)/0.18), transparent 70%)',
            }}
          />

          <div className="relative">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Verkauf</h1>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">
              WhatsApp · Angebote · Termine · Kataloge
            </p>

            {/* WhatsApp Hotline */}
            <div className="mt-8 flex flex-col items-center">
              <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                Hotline Verkauf
              </span>

              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 relative inline-flex items-center gap-3 rounded-2xl border border-primary/50 bg-primary/10 px-5 py-4 transition-transform duration-300 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {/* Pulsringe */}
                <span
                  aria-hidden
                  className="absolute -inset-1 rounded-2xl border border-primary/40 animate-ping opacity-60"
                />
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <MessageCircle className="h-5 w-5 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
                </span>
                <span className="relative text-left">
                  <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
                    WhatsApp
                  </span>
                  <span className="block font-mono text-lg sm:text-2xl font-semibold tabular-nums text-primary">
                    {shown}
                    <span className="ml-0.5 inline-block w-[2px] animate-pulse bg-primary align-middle h-5" />
                  </span>
                </span>
              </a>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="hover-scale">
                  <a href={WA_LINK} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp Chat starten
                  </a>
                </Button>
                
                <Button variant="ghost" size="lg" onClick={copy}>
                  {copied ? (
                    <Check className="mr-2 h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copied ? 'Kopiert' : 'Nummer kopieren'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline" size="lg">
            <Link to="/book">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
