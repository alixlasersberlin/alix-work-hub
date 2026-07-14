import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useKalenderEvents } from '@/hooks/useKalenderEvents';
import { eventStyle } from '@/lib/kalender/event-colors';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight } from 'lucide-react';

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }

export default function KalenderAgenda() {
  const [days] = useState(14);
  const [scope, setScope] = useState<'me' | 'all'>('me');
  const from = startOfDay(new Date());
  const to = addDays(from, days);

  const { events, loading } = useKalenderEvents({ from, to, onlyMine: scope === 'me' });

  const grouped = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const e of events) {
      const key = new Date(e.start_at).toDateString();
      if (!map.has(key)) map.set(key, [] as any);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort(([a],[b]) => new Date(a).getTime() - new Date(b).getTime());
  }, [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Agenda · {days} Tage</h2>
        <div className="flex rounded-full border border-border overflow-hidden text-xs">
          <button onClick={() => setScope('me')} className={`px-3 py-1.5 ${scope==='me'?'bg-primary text-primary-foreground':'text-muted-foreground'}`}>Meine</button>
          <button onClick={() => setScope('all')} className={`px-3 py-1.5 ${scope==='all'?'bg-primary text-primary-foreground':'text-muted-foreground'}`}>Team</button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2"><Skeleton className="h-16"/><Skeleton className="h-16"/><Skeleton className="h-16"/></div>
      ) : grouped.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Keine Termine im Zeitraum.</div>
      ) : (
        grouped.map(([day, list]) => {
          const d = new Date(day);
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <section key={day}>
              <div className="sticky top-14 z-10 bg-background/95 backdrop-blur py-1 -mx-3 px-3 border-b border-border">
                <div className={`text-xs font-semibold uppercase tracking-widest ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
                  {isToday && ' · Heute'}
                </div>
              </div>
              <ul className="mt-2 space-y-2">
                {list.map(e => {
                  const s = eventStyle(e.event_kind);
                  return (
                    <li key={e.id}>
                      <Link to={`/m/kalender/termin/${e.id}`}>
                        <Card className={`p-3 flex items-center gap-3 border-l-4 ${s.border}`}>
                          <div className="w-14 text-center">
                            <div className="text-xs">{fmtTime(e.start_at)}</div>
                            <div className="text-[10px] text-muted-foreground">{fmtTime(e.end_at)}</div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{e.title}</div>
                            <div className="text-xs text-muted-foreground truncate">{e.customer_name || e.location || ''}</div>
                          </div>
                          <Badge variant="outline" className={`${s.fg} ${s.border} text-[10px]`}>{s.label}</Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </Card>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
