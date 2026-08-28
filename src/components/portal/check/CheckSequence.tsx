import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { DeviceSilhouette } from './DeviceSilhouette';
import alixLogo from '@/assets/alix-logo-gold.png';
import '@/styles/delivery-check.css';

const STAGES = [
  { running: 'Auftrag wird gesucht', done: 'Auftrag gefunden' },
  { running: 'Lieferinformationen werden geladen', done: 'Informationen verfügbar' },
  { running: 'Lieferstatus wird vorbereitet', done: 'Bereit' },
];

/**
 * Kurze, hochwertige Ladesequenz (~2,6 s).
 * Zeigt ausschließlich den tatsächlichen Ablauf: Suche → Daten laden → Darstellung.
 */
export function CheckSequence({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStage(1), 950),
      window.setTimeout(() => setStage(2), 1850),
      window.setTimeout(() => onDone(), 2650),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center py-10 text-center">
      <div className="relative w-40 h-36 sm:w-52 sm:h-44 mb-6">
        <DeviceSilhouette />
        <img
          src={alixLogo}
          alt=""
          className="absolute inset-x-0 -bottom-2 mx-auto h-6 w-auto opacity-80 dc-fade dc-d3"
        />
      </div>

      <div className="w-full max-w-xs space-y-3">
        {STAGES.map((s, i) => {
          const done = i < stage;
          const active = i === stage;
          if (i > stage) {
            return (
              <div key={s.running} className="flex items-center gap-3 text-sm text-muted-foreground/40">
                <span className="w-5 h-5 rounded-full border border-current/40" />
                <span>{s.running}</span>
              </div>
            );
          }
          return (
            <div key={s.running} className="flex items-center gap-3 text-sm dc-fade">
              {done ? (
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center dc-check-pop">
                  <Check className="w-3.5 h-3.5" />
                </span>
              ) : (
                <span className="w-5 h-5 flex items-center justify-center text-primary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </span>
              )}
              <span className={done ? 'text-foreground' : 'text-foreground/80'}>
                {done ? s.done : s.running}
              </span>
            </div>
          );
        })}
      </div>

      <div className="relative mt-8 h-px w-48 overflow-hidden bg-border dc-sweep" />
    </div>
  );
}
