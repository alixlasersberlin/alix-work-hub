import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useKalenderEvents, confirmEvent } from '@/hooks/useKalenderEvents';

/**
 * Optische Eskalation:
 *  - Stufe 1 (gelb): eigener Termin startet in ≤ 15 Minuten
 *  - Stufe 2 (orange): Termin startet in ≤ 5 Minuten
 *  - Stufe 3 (rot, blinkend): Termin ist gestartet und noch nicht bestätigt / in Bearbeitung
 */
export default function EscalationOverlay() {
  const nav = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const from = useMemo(() => new Date(now.getTime() - 30 * 60 * 1000), [now]);
  const to = useMemo(() => new Date(now.getTime() + 2 * 60 * 60 * 1000), [now]);
  const { events } = useKalenderEvents({ from, to, onlyMine: true });

  const critical = useMemo(() => {
    return events
      .filter((e) => !dismissed.has(e.id))
      .map((e) => {
        const start = new Date(e.start_at).getTime();
        const diffMin = Math.round((start - now.getTime()) / 60000);
        const status = (e.appointment_status || e.status || '').toLowerCase();
        const active = !['completed', 'cancelled', 'in_progress'].includes(status);
        if (!active) return null;
        let level: 1 | 2 | 3 | null = null;
        if (diffMin <= 0 && diffMin > -60) level = 3;
        else if (diffMin > 0 && diffMin <= 5) level = 2;
        else if (diffMin > 5 && diffMin <= 15) level = 1;
        return level ? { e, diffMin, level } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b!.level - a!.level || a!.diffMin - b!.diffMin)[0] as
      | { e: any; diffMin: number; level: 1 | 2 | 3 }
      | undefined;
  }, [events, now, dismissed]);

  if (!critical) return null;

  const { e, diffMin, level } = critical;
  const palette =
    level === 3
      ? 'bg-red-600 text-white border-red-700 animate-pulse'
      : level === 2
      ? 'bg-orange-500 text-white border-orange-600'
      : 'bg-amber-400 text-black border-amber-500';

  const label =
    level === 3
      ? `Jetzt fällig${diffMin < 0 ? ` · ${Math.abs(diffMin)} min überfällig` : ''}`
      : `In ${diffMin} min`;

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]"
      role="alert"
    >
      <div className={`rounded-lg border shadow-lg px-3 py-2 flex items-center gap-3 ${palette}`}>
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase font-semibold tracking-wider opacity-90">
            {label}
          </div>
          <div className="text-sm font-semibold truncate">{e.title}</div>
          {e.customer_name && (
            <div className="text-xs opacity-90 truncate">{e.customer_name}</div>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-2 text-xs"
          onClick={() => nav(`/m/kalender/termin/${e.id}`)}
        >
          Öffnen
        </Button>
        {level === 3 && (
          <Button
            size="sm"
            variant="secondary"
            className="h-8 px-2 text-xs"
            onClick={async () => {
              try {
                await confirmEvent(e.id, 'in_progress');
                setDismissed((s) => new Set(s).add(e.id));
              } catch {}
            }}
          >
            Start
          </Button>
        )}
        <button
          aria-label="Ausblenden"
          className="p-1 opacity-80 hover:opacity-100"
          onClick={() => setDismissed((s) => new Set(s).add(e.id))}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
