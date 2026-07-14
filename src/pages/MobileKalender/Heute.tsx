import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useKalenderEvents } from '@/hooks/useKalenderEvents';
import { eventStyle, STATUS_LABELS } from '@/lib/kalender/event-colors';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import InstallPrompt from '@/components/kalender/InstallPrompt';
import { AlertTriangle, Bell, CalendarClock, ChevronRight, Clock, MapPin, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function useCountdown(iso?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000 * 30); return () => clearInterval(t); }, []);
  if (!iso) return null;
  const diff = new Date(iso).getTime() - now;
  const sign = diff < 0 ? '−' : '';
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  if (h >= 24) return `${sign}${Math.floor(h / 24)} Tage`;
  if (h >= 1) return `${sign}${h} h ${m} min`;
  return `${sign}${m} min`;
}

export default function KalenderHeute() {
  const { user } = useAuth();
  const now = new Date();
  const [scope, setScope] = useState<'me' | 'all'>('me');

  const { events, loading } = useKalenderEvents({
    from: startOfDay(now),
    to: endOfDay(now),
    onlyMine: scope === 'me',
  });

  const upcoming = useMemo(() => events.filter(e => new Date(e.end_at).getTime() >= now.getTime())
    .sort((a,b) => a.start_at.localeCompare(b.start_at)), [events, now]);
  const next = upcoming[0];
  const countdown = useCountdown(next?.start_at);
  const overdue = events.filter(e =>
    new Date(e.end_at).getTime() < now.getTime()
    && !['completed','cancelled','no_show'].includes(e.status || '')
  );
  const unconfirmed = events.filter(e =>
    e.requires_confirmation && (e.confirmation_status || 'pending') !== 'confirmed'
  );

  return (
    <div className="space-y-3">
      <InstallPrompt />

      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">
            {now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div className="flex rounded-full border border-border overflow-hidden text-xs">
          <button onClick={() => setScope('me')} className={`px-3 py-1.5 ${scope==='me'?'bg-primary text-primary-foreground':'text-muted-foreground'}`}>Meine</button>
          <button onClick={() => setScope('all')} className={`px-3 py-1.5 ${scope==='all'?'bg-primary text-primary-foreground':'text-muted-foreground'}`}>Team</button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-32" />
      ) : next ? (
        <Link to={`/m/kalender/termin/${next.id}`}>
          <Card className={`p-4 border-l-4 ${eventStyle(next.event_kind).border} relative overflow-hidden`}>
            <div className="text-[10px] uppercase tracking-widest text-primary flex items-center gap-1">
              <CalendarClock className="h-3 w-3" /> Nächster Termin
            </div>
            <div className="text-xl font-bold mt-1 leading-tight">{next.title}</div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {fmtTime(next.start_at)}–{fmtTime(next.end_at)}</span>
              {next.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {next.location}</span>}
              {next.customer_name && <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> {next.customer_name}</span>}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Badge className={`${eventStyle(next.event_kind).bg} ${eventStyle(next.event_kind).fg} border-0`}>{eventStyle(next.event_kind).label}</Badge>
              {countdown && <div className="text-lg font-bold tabular-nums">{countdown}</div>}
            </div>
          </Card>
        </Link>
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground">Keine weiteren Termine heute.</Card>
      )}

      {overdue.length > 0 && (
        <Card className="p-3 border-rose-500/40 bg-rose-500/5">
          <div className="text-sm font-semibold flex items-center gap-2 text-rose-400">
            <AlertTriangle className="h-4 w-4" /> {overdue.length} überfälliger Termin{overdue.length !== 1 ? 'e' : ''}
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {overdue.slice(0,3).map(e => (
              <li key={e.id}><Link to={`/m/kalender/termin/${e.id}`} className="hover:underline">{fmtTime(e.start_at)} · {e.title}</Link></li>
            ))}
          </ul>
        </Card>
      )}

      {unconfirmed.length > 0 && (
        <Card className="p-3 border-amber-500/40 bg-amber-500/5">
          <div className="text-sm font-semibold flex items-center gap-2 text-amber-400">
            <Bell className="h-4 w-4" /> {unconfirmed.length} offene Bestätigung{unconfirmed.length !== 1 ? 'en' : ''}
          </div>
        </Card>
      )}

      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Alle Termine heute</div>
        {loading ? (
          <div className="space-y-2"><Skeleton className="h-16"/><Skeleton className="h-16"/></div>
        ) : events.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Keine Termine für heute.</div>
        ) : (
          <ul className="space-y-2">
            {events.map(e => {
              const s = eventStyle(e.event_kind);
              return (
                <li key={e.id}>
                  <Link to={`/m/kalender/termin/${e.id}`}>
                    <Card className={`p-3 flex items-center gap-3 border-l-4 ${s.border} hover:bg-secondary/50 transition`}>
                      <div className="w-14 text-center">
                        <div className="text-xs text-muted-foreground">{fmtTime(e.start_at)}</div>
                        <div className="text-[10px] text-muted-foreground">{fmtTime(e.end_at)}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{e.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {e.customer_name || e.location || STATUS_LABELS[e.status || ''] || ''}
                        </div>
                      </div>
                      <Badge variant="outline" className={`${s.fg} ${s.border} text-[10px]`}>{s.label}</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="pt-2 text-xs text-muted-foreground text-center">
        Angemeldet als {user?.email || 'Benutzer'}
      </div>
    </div>
  );
}
