import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, AlertTriangle, Plus } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, startOfDay, endOfDay, addWeeks, isSameDay, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

type Tour = any;

const STATUS_COLORS: Record<string, string> = {
  'Entwurf': 'bg-muted text-foreground',
  'Geplant': 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
  'Bestätigt': 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  'Unterwegs': 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  'Vor Ort': 'bg-amber-500/30 text-amber-200 border border-amber-500/60',
  'Erledigt': 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/60',
  'Fehlgeschlagen': 'bg-destructive/30 text-destructive border border-destructive/60',
  'Verschoben': 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
  'Storniert': 'bg-muted text-muted-foreground line-through',
  'offen': 'bg-muted text-foreground',
  'geplant': 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
  'erledigt': 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/60',
};

export default function TourenKalender() {
  const navigate = useNavigate();
  const [view, setView] = useState<'day' | 'week'>('week');
  const [anchor, setAnchor] = useState(new Date());
  const [tours, setTours] = useState<Tour[]>([]);
  const [technicianFilter, setTechnicianFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    if (view === 'day') return { from: startOfDay(anchor), to: endOfDay(anchor) };
    return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: endOfWeek(anchor, { weekStartsOn: 1 }) };
  }, [view, anchor]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('route_plans')
        .select('*')
        .gte('planned_date', format(range.from, 'yyyy-MM-dd'))
        .lte('planned_date', format(range.to, 'yyyy-MM-dd'))
        .order('planned_date', { ascending: true });
      setTours(data ?? []);
      setLoading(false);
    })();
  }, [range.from.getTime(), range.to.getTime()]);

  const techList = useMemo(() => {
    const set = new Set<string>();
    tours.forEach(t => { if (t.assigned_employee) set.add(t.assigned_employee); });
    return Array.from(set).sort();
  }, [tours]);

  const filteredTours = useMemo(() => tours.filter(t =>
    (technicianFilter === 'all' || t.assigned_employee === technicianFilter) &&
    (statusFilter === 'all' || t.planning_status === statusFilter)
  ), [tours, technicianFilter, statusFilter]);

  const days = useMemo(() => {
    const d: Date[] = [];
    let cur = range.from;
    while (cur <= range.to) { d.push(cur); cur = addDays(cur, 1); }
    return d;
  }, [range.from, range.to]);

  // Conflict detection: same technician + overlapping time slot on same day
  const conflictIds = useMemo(() => {
    const map = new Map<string, Tour[]>();
    filteredTours.forEach(t => {
      if (!t.assigned_employee || !t.planned_date) return;
      const k = `${t.assigned_employee}|${t.planned_date}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    });
    const conflicts = new Set<string>();
    map.forEach(arr => {
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j];
        const as = a.time_window_start || '00:00', ae = a.time_window_end || '23:59';
        const bs = b.time_window_start || '00:00', be = b.time_window_end || '23:59';
        if (as < be && bs < ae) { conflicts.add(a.id); conflicts.add(b.id); }
      }
    });
    return conflicts;
  }, [filteredTours]);

  async function onDropTour(tourId: string, newDate: Date) {
    const dateStr = format(newDate, 'yyyy-MM-dd');
    const { error } = await supabase.from('route_plans').update({ planned_date: dateStr }).eq('id', tourId);
    if (!error) setTours(prev => prev.map(t => t.id === tourId ? { ...t, planned_date: dateStr } : t));
  }

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-primary" />
          Tourenkalender
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setAnchor(view === 'day' ? addDays(anchor, -1) : addWeeks(anchor, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>Heute</Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(view === 'day' ? addDays(anchor, 1) : addWeeks(anchor, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Select value={view} onValueChange={(v) => setView(v as 'day' | 'week')}>
            <SelectTrigger className="w-32 bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Tag</SelectItem>
              <SelectItem value="week">Woche</SelectItem>
            </SelectContent>
          </Select>
          <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
            <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue placeholder="Techniker" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Techniker</SelectItem>
              {techList.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {['Entwurf','Geplant','Bestätigt','Unterwegs','Vor Ort','Erledigt','Fehlgeschlagen','Verschoben','Storniert'].map(s =>
                <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="gold-gradient text-primary-foreground" onClick={() => navigate('/tourenplanung/neu')}>
            <Plus className="w-4 h-4 mr-1" /> Neue Tour
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground mb-3">
        {format(range.from, 'dd.MM.yyyy', { locale: de })} – {format(range.to, 'dd.MM.yyyy', { locale: de })}
        {conflictIds.size > 0 && (
          <span className="ml-3 inline-flex items-center gap-1 text-amber-400">
            <AlertTriangle className="w-3 h-3" /> {conflictIds.size / 2} Konflikt(e)
          </span>
        )}
      </div>

      <div className={`grid gap-2 ${view === 'day' ? 'grid-cols-1' : 'grid-cols-7'}`}>
        {days.map(d => {
          const dayTours = filteredTours.filter(t => t.planned_date && isSameDay(parseISO(t.planned_date), d));
          return (
            <div
              key={d.toISOString()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData('text/plain');
                if (id) onDropTour(id, d);
              }}
              className="rounded-xl border border-border bg-card p-3 min-h-[200px]"
            >
              <div className="text-xs font-bold text-foreground mb-2">
                {format(d, 'EEE dd.MM.', { locale: de })}
              </div>
              <div className="space-y-2">
                {dayTours.length === 0 && <div className="text-xs text-muted-foreground">–</div>}
                {dayTours.map(t => (
                  <Link
                    key={t.id}
                    to={`/tourenplanung/${t.id}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                    className={`block rounded-lg p-2 text-xs ${STATUS_COLORS[t.planning_status] || 'bg-muted'} ${conflictIds.has(t.id) ? 'ring-2 ring-amber-500' : ''}`}
                  >
                    <div className="font-semibold truncate">
                      {t.tour_type || 'Tour'} {t.contact_name ? `· ${t.contact_name}` : ''}
                    </div>
                    <div className="text-[10px] opacity-80">
                      {t.time_window_start?.slice(0,5) || '--:--'}–{t.time_window_end?.slice(0,5) || '--:--'}
                      {t.assigned_employee && ` · ${t.assigned_employee}`}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {loading && <div className="text-sm text-muted-foreground mt-4">Lade …</div>}
    </div>
  );
}
