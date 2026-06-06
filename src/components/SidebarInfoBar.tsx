import { useEffect, useState } from 'react';
import { CalendarDays, Clock, Thermometer, Hash, Globe2 } from 'lucide-react';

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
  const timePeking = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' });
  const timeMiami = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });

  return (
    <div className="px-3 py-2 border-b border-border bg-sidebar-accent/30 text-[11px] text-muted-foreground">
      <div className="flex items-center justify-between gap-2 flex-wrap tabular-nums">
        <span className="inline-flex items-center gap-1">
          <Hash className="w-3 h-3 text-primary/80" /> KW {kw}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="w-3 h-3 text-primary/80" /> {date}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3 text-primary/80" /> {time}
        </span>
        <span className="inline-flex items-center gap-1">
          <Thermometer className="w-3 h-3 text-primary/80" />
          {temp !== null ? `${Math.round(temp)}°` : '—'} Berlin
        </span>
        <span className="inline-flex items-center gap-1">
          <Globe2 className="w-3 h-3 text-primary/80" /> Peking {timePeking}
        </span>
        <span className="inline-flex items-center gap-1">
          <Globe2 className="w-3 h-3 text-primary/80" /> Miami {timeMiami}
        </span>
      </div>
    </div>
  );
}
