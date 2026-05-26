import { useEffect, useState } from 'react';
import { CalendarDays, Clock, Thermometer, Hash } from 'lucide-react';

function getISOWeek(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function SidebarInfoBar() {
  const [now, setNow] = useState(new Date());
  const [temp, setTemp] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchTemp = async () => {
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.405&current=temperature_2m&timezone=Europe%2FBerlin'
        );
        const json = await res.json();
        if (!cancelled && typeof json?.current?.temperature_2m === 'number') {
          setTemp(json.current.temperature_2m);
        }
      } catch {
        /* ignore */
      }
    };
    fetchTemp();
    const t = setInterval(fetchTemp, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const kw = getISOWeek(now);
  const date = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="px-4 py-2.5 border-b border-border bg-sidebar-accent/30 text-[11.5px] text-muted-foreground space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5">
          <Hash className="w-3 h-3 text-primary/80" /> KW {kw}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Thermometer className="w-3 h-3 text-primary/80" />
          {temp !== null ? `${Math.round(temp)}°C Berlin` : '— Berlin'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="w-3 h-3 text-primary/80" /> {date}
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Clock className="w-3 h-3 text-primary/80" /> {time}
        </span>
      </div>
    </div>
  );
}
