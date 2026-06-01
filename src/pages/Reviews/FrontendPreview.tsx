import { useState } from 'react';
import { Star, Monitor } from 'lucide-react';

/**
 * Statische Vorschau des Kunden-Bewertungsformulars (read-only).
 * Spiegelt das Layout von src/pages/PublicReview/ReviewForm.tsx wider,
 * damit Admins sehen, was der Kunde beim Klick auf den Bewertungslink sieht.
 */
export default function FrontendPreview() {
  const [delivery, setDelivery] = useState(0);
  const [driver, setDriver] = useState(0);
  const [training, setTraining] = useState<'ja' | 'teilweise' | 'nein' | ''>('');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Monitor className="h-4 w-4" />
        Vorschau: So sehen Kunden das Bewertungsformular (interaktive Demo, keine Daten werden gespeichert).
      </div>

      <div className="rounded-2xl border border-border overflow-hidden bg-white">
        <div className="bg-white text-neutral-900 px-4 py-10 min-h-[600px] flex flex-col items-center">
          <header className="w-full max-w-2xl flex items-center justify-center mb-8">
            <div className="text-center">
              <div className="text-2xl font-bold tracking-tight">Alix Lasers</div>
              <div className="text-xs uppercase tracking-widest text-neutral-500 mt-1">Kundenbewertung</div>
            </div>
          </header>

          <div className="w-full max-w-2xl bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-8">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-semibold">Ihre Bewertung zu Ihrer Lieferung</h1>
              <p className="text-sm text-neutral-600">
                Hallo Max Mustermann, vielen Dank, dass Sie sich kurz Zeit nehmen.
              </p>
              <div className="text-xs text-neutral-500 pt-2">
                Auftrag: <span className="font-mono">SO-12345</span> · Produkt: Beispiel-Laser · Liefertermin: 01.06.2026
              </div>
            </div>

            <Question label="Wie waren Sie mit der Lieferung des Produktes zufrieden?">
              <StarPicker value={delivery} onChange={setDelivery} />
            </Question>

            <Question label="War der Fahrer freundlich?">
              <StarPicker value={driver} onChange={setDriver} />
              <textarea
                placeholder="Optional: Anmerkungen zum Fahrer"
                className="mt-3 w-full rounded-md border border-neutral-300 p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </Question>

            <Question label="Hat er Sie geschult und am Gerät eingewiesen?">
              <div className="flex flex-wrap gap-2">
                {(['ja', 'teilweise', 'nein'] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTraining(v)}
                    className={`px-4 py-2 rounded-md border text-sm transition ${
                      training === v
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : 'bg-white text-neutral-800 border-neutral-300 hover:border-neutral-500'
                    }`}
                  >
                    {v === 'ja' ? 'Ja' : v === 'teilweise' ? 'Teilweise' : 'Nein'}
                  </button>
                ))}
              </div>
            </Question>

            <Question label="Welche Verbesserungen haben Sie für den Service?">
              <textarea
                placeholder="Ihre Anregungen (optional)"
                className="w-full rounded-md border border-neutral-300 p-3 text-sm min-h-[110px] focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </Question>

            <button
              type="button"
              disabled
              className="w-full bg-neutral-900 text-white text-base font-semibold rounded-xl py-4 opacity-60 cursor-not-allowed"
            >
              Bewertung absenden (Vorschau)
            </button>

            <p className="text-xs text-neutral-500 text-center">
              Ihre Angaben werden ausschließlich zur Verbesserung unseres Services verwendet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-neutral-900">{label}</div>
      {children}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="p-1"
          aria-label={`${n} Sterne`}
        >
          <Star className={`h-8 w-8 ${n <= display ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'}`} />
        </button>
      ))}
      {value > 0 && <span className="ml-2 text-sm text-neutral-600">{value}/5</span>}
    </div>
  );
}
