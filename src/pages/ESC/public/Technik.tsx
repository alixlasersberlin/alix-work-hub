import { Headset, Wrench, Clock, MessageCircle } from 'lucide-react';

const items = [
  {
    icon: Headset,
    title: 'SCHNELLER SUPPORT',
    lines: ['Direkte Hilfe vom', 'Technikteam'],
  },
  {
    icon: Wrench,
    title: 'TECHNISCHE HILFE',
    lines: ['Bei Fragen, Fehlern', 'oder Wartung'],
  },
  {
    icon: Clock,
    title: 'ZEITNAH & EFFEKTIV',
    lines: ['Wir antworten', 'so schnell wie möglich'],
  },
];

const WHATSAPP_NUMBER = '+49 160 226 3888';
const WHATSAPP_LINK = 'https://wa.me/491602263888';

export default function Technik() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 sm:p-8">
      <section className="w-full max-w-xl">
        <div className="rounded-3xl border border-primary/40 bg-card/60 backdrop-blur shadow-[0_0_40px_-12px_hsl(var(--primary)/0.6)] p-5 sm:p-8">
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center text-center gap-4 group"
          >
            <span className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[hsl(142_70%_45%)] flex items-center justify-center transition-transform group-hover:scale-105">
              <MessageCircle className="w-8 h-8 sm:w-9 sm:h-9 text-white" fill="currentColor" strokeWidth={0} />
            </span>
            <span className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Technik – WhatsApp</h1>
              <span className="block text-2xl sm:text-3xl font-bold text-primary tabular-nums">
                {WHATSAPP_NUMBER}
              </span>
            </span>
          </a>

          <ul className="mt-6 divide-y divide-border/60 border-t border-border/60">
            {items.map(({ icon: Icon, title, lines }) => (
              <li key={title} className="flex flex-col items-center text-center gap-2 py-5">
                <Icon className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 text-foreground/80" strokeWidth={1.5} />
                <div>
                  <h2 className="text-base sm:text-lg font-semibold tracking-wide">{title}</h2>
                  <p className="text-sm sm:text-base text-muted-foreground leading-snug">
                    {lines.map((l) => (
                      <span key={l} className="block">{l}</span>
                    ))}
                  </p>
                </div>
              </li>
            ))}
          </ul>

        </div>
      </section>
    </main>
  );
}
