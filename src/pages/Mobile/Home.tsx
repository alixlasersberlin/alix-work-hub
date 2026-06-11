import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, ChevronRight, Loader2, Search, CheckCircle2, CircleDot, AlertTriangle } from 'lucide-react';

interface Tour {
  id: string;
  planned_date: string | null;
  time_window: string | null;
  contact_name: string | null;
  address_line: string | null;
  city: string | null;
  zip: string | null;
  planning_status: string | null;
  tour_type: string | null;
  priority: string | null;
  check_in_at?: string | null;
  check_out_at?: string | null;
}

function isSameDay(a?: string | null, b: Date = new Date()) {
  if (!a) return false;
  const d = new Date(a);
  return d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth() && d.getDate() === b.getDate();
}

const STATUS_TONE: Record<string, string> = {
  'Vor Ort': 'bg-amber-500/15 text-amber-500',
  'Erledigt': 'bg-emerald-500/15 text-emerald-500',
  'Geplant': 'bg-primary/10 text-primary',
  'Offen': 'bg-muted text-muted-foreground',
};

export default function MobileHome() {
  const { user, isAdmin } = useAuth();
  const { pathname } = useLocation();
  const todayOnly = pathname.endsWith('/heute');
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!user) return;
    setRefreshing(true);
    let qb = supabase.from('route_plans')
      .select('id, planned_date, time_window, contact_name, address_line, city, zip, planning_status, tour_type, priority, check_in_at, check_out_at')
      .order('planned_date', { ascending: true })
      .limit(100);
    if (!isAdmin) qb = qb.eq('technician_user_id', user.id);
    const { data } = await qb as any;
    setTours((data || []) as Tour[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, isAdmin]);

  const filtered = useMemo(() => {
    let arr = tours;
    if (todayOnly) arr = arr.filter(t => isSameDay(t.planned_date));
    if (q.trim()) {
      const s = q.toLowerCase();
      arr = arr.filter(t =>
        (t.contact_name || '').toLowerCase().includes(s) ||
        (t.city || '').toLowerCase().includes(s) ||
        (t.address_line || '').toLowerCase().includes(s) ||
        (t.zip || '').includes(s)
      );
    }
    return arr;
  }, [tours, q, todayOnly]);

  const groups = useMemo(() => {
    const map = new Map<string, Tour[]>();
    for (const t of filtered) {
      const key = t.planned_date ? new Date(t.planned_date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) : 'Ohne Datum';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const stats = useMemo(() => {
    const today = tours.filter(t => isSameDay(t.planned_date));
    return {
      total: today.length,
      done: today.filter(t => !!t.check_out_at).length,
      open: today.filter(t => !t.check_out_at).length,
    };
  }, [tours]);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{todayOnly ? 'Heute' : 'Meine Einsätze'}</h1>
        <Button size="sm" variant="ghost" onClick={load} disabled={refreshing}>
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aktualisieren'}
        </Button>
      </div>

      {!todayOnly && (
        <Card className="p-3 grid grid-cols-3 text-center text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Heute</div>
            <div className="font-bold text-lg">{stats.total}</div>
          </div>
          <div className="border-x border-border">
            <div className="text-xs text-muted-foreground">Offen</div>
            <div className="font-bold text-lg text-primary">{stats.open}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Erledigt</div>
            <div className="font-bold text-lg text-emerald-500">{stats.done}</div>
          </div>
        </Card>
      )}

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Kunde, Ort, PLZ…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> lädt…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {todayOnly ? 'Heute keine Einsätze.' : 'Keine Einsätze gefunden.'}
        </Card>
      ) : (
        groups.map(([day, items]) => (
          <div key={day} className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground px-1 pt-2">{day}</div>
            {items.map(t => {
              const done = !!t.check_out_at;
              const active = !!t.check_in_at && !done;
              const Icon = done ? CheckCircle2 : active ? CircleDot : t.priority === 'hoch' ? AlertTriangle : Clock;
              const tone = STATUS_TONE[t.planning_status || ''] || 'bg-muted text-muted-foreground';
              return (
                <Link key={t.id} to={`/m/einsatz/${t.id}`}>
                  <Card className={`p-4 active:scale-[0.99] transition-transform ${done ? 'opacity-70' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${done ? 'text-emerald-500' : active ? 'text-amber-500' : 'text-primary'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {t.time_window && <span>{t.time_window}</span>}
                          {t.tour_type && <span className="px-1.5 py-0.5 rounded bg-secondary text-foreground">{t.tour_type}</span>}
                          {t.priority === 'hoch' && <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">hoch</span>}
                        </div>
                        <div className="font-semibold mt-0.5 truncate">{t.contact_name || '—'}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{[t.address_line, t.zip, t.city].filter(Boolean).join(', ') || '—'}</span>
                        </div>
                        {t.planning_status && (
                          <span className={`inline-block mt-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${tone}`}>
                            {t.planning_status}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
