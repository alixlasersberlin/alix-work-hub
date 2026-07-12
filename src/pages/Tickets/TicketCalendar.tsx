import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  addMonths, addWeeks, subMonths, subWeeks,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, format, isToday,
} from 'date-fns';
import { de } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, CalendarDays, Filter, RefreshCw,
  ExternalLink, Mail, Phone, User2, Clock, AlertCircle, Download, UserCircle2,
} from 'lucide-react';

type TicketEvent = {
  id: string;
  ticket_id: string | null;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  event_kind: string | null;
  appointment_status: string | null;
  confirmation_status: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  priority: string | null;
  department_id: string | null;
  assigned_user_id: string | null;
  location?: string | null;
  tickets?: { ticket_number: string | null; status: string | null; priority: string | null; department: string | null } | null;
};

type Dept = { id: string; name: string; color: string | null };
type UserRow = { id: string; full_name: string | null; email: string | null; is_active: boolean | null };

const KIND_LABEL: Record<string, string> = {
  kundentermin: 'Kundentermin',
  beratung: 'Beratung',
  rueckruf: 'Rückruf',
  wiedervorlage: 'Wiedervorlage',
  frist: 'Frist',
  eskalation: 'Eskalation',
};

const KINDS = Object.keys(KIND_LABEL);

const STATUS_TONE: Record<string, { bg: string; text: string; ring: string }> = {
  bestaetigt: { bg: 'bg-emerald-500/15', text: 'text-emerald-500', ring: 'ring-emerald-500/30' },
  bestaetigung_ausstehend: { bg: 'bg-amber-500/15', text: 'text-amber-500', ring: 'ring-amber-500/30' },
  abgelehnt: { bg: 'bg-destructive/15', text: 'text-destructive', ring: 'ring-destructive/30' },
  bestaetigung_abgelaufen: { bg: 'bg-destructive/15', text: 'text-destructive', ring: 'ring-destructive/30' },
  geplant: { bg: 'bg-primary/15', text: 'text-primary', ring: 'ring-primary/30' },
};

const PRIO_TONE: Record<string, string> = {
  Kritisch: 'bg-destructive text-destructive-foreground',
  Dringend: 'bg-destructive/80 text-destructive-foreground',
  Hoch: 'bg-amber-500 text-white',
  Normal: 'bg-primary/70 text-primary-foreground',
  Niedrig: 'bg-muted text-muted-foreground',
};

type ViewMode = 'month' | 'week';

export default function TicketCalendar() {
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [cursor, setCursor] = useState<Date>(new Date());
  const [view, setView] = useState<ViewMode>('month');
  const [loading, setLoading] = useState(false);

  const [fDepts, setFDepts] = useState<Set<string>>(new Set());
  const [fKinds, setFKinds] = useState<Set<string>>(new Set());
  const [fStatus, setFStatus] = useState<Set<string>>(new Set());
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const [selected, setSelected] = useState<TicketEvent | null>(null);


  const range = useMemo(() => {
    const from = view === 'month' ? startOfMonth(cursor) : startOfWeek(cursor, { weekStartsOn: 1 });
    const to = view === 'month' ? endOfMonth(cursor) : endOfWeek(cursor, { weekStartsOn: 1 });
    return { from, to };
  }, [cursor, view]);

  const load = async () => {
    setLoading(true);
    const gridFrom = view === 'month'
      ? startOfWeek(range.from, { weekStartsOn: 1 })
      : range.from;
    const gridTo = view === 'month'
      ? endOfWeek(range.to, { weekStartsOn: 1 })
      : range.to;

    const [{ data: evData }, { data: dData }, { data: uData }] = await Promise.all([
      supabase.from('esc_events')
        .select('id, ticket_id, title, description, start_at, end_at, event_kind, appointment_status, confirmation_status, customer_name, customer_email, customer_phone, priority, department_id, assigned_user_id, location, tickets:ticket_id(ticket_number, status, priority, department)')
        .eq('source', 'ticket')
        .gte('start_at', gridFrom.toISOString())
        .lte('start_at', gridTo.toISOString())
        .order('start_at', { ascending: true })
        .limit(500),
      supabase.from('esc_departments').select('id, name, color'),
      supabase.from('user_profiles').select('id, full_name, email, is_active').eq('is_active', true).order('full_name'),
    ]);
    setEvents((evData as any) ?? []);
    setDepts((dData as any) ?? []);
    setUsers((uData as any) ?? []);
    setLoading(false);
  };

  const userById = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users]);

  // Drag & Drop: Termin auf anderen Tag verschieben (Uhrzeit bleibt gleich)
  const onDropOnDay = async (targetKey: string, ev: React.DragEvent) => {
    ev.preventDefault();
    setDragOverKey(null);
    const eventId = ev.dataTransfer.getData('text/event-id');
    if (!eventId) return;
    const src = events.find(e => e.id === eventId);
    if (!src) return;
    const targetDay = new Date(targetKey + 'T00:00:00');
    const srcStart = new Date(src.start_at);
    if (isSameDay(targetDay, srcStart)) return;
    const newStart = new Date(targetDay);
    newStart.setHours(srcStart.getHours(), srcStart.getMinutes(), 0, 0);
    let newEndIso: string | null = null;
    if (src.end_at) {
      const diff = new Date(src.end_at).getTime() - srcStart.getTime();
      newEndIso = new Date(newStart.getTime() + diff).toISOString();
    }
    // Optimistic
    setEvents(list => list.map(e => e.id === eventId ? { ...e, start_at: newStart.toISOString(), end_at: newEndIso } : e));
    const { error } = await supabase.from('esc_events')
      .update({ start_at: newStart.toISOString(), end_at: newEndIso })
      .eq('id', eventId);
    if (error) { toast.error('Verschieben fehlgeschlagen: ' + error.message); load(); }
    else toast.success(`Verschoben auf ${format(newStart, 'dd.MM. HH:mm', { locale: de })}`);
  };

  const assignUser = async (eventId: string, userId: string | null) => {
    setEvents(list => list.map(e => e.id === eventId ? { ...e, assigned_user_id: userId } : e));
    setSelected(s => s && s.id === eventId ? { ...s, assigned_user_id: userId } : s);
    const { error } = await supabase.from('esc_events').update({ assigned_user_id: userId }).eq('id', eventId);
    if (error) { toast.error('Zuweisung fehlgeschlagen'); load(); }
    else toast.success(userId ? 'Zugewiesen' : 'Zuweisung entfernt');
  };

  const downloadIcs = (e: TicketEvent) => {
    const dt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const end = e.end_at ?? new Date(new Date(e.start_at).getTime() + 60 * 60_000).toISOString();
    const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AlixWork//Ticket-Kalender//DE',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:ticket-${e.id}@alixwork`,
      `DTSTAMP:${dt(new Date().toISOString())}`,
      `DTSTART:${dt(e.start_at)}`,
      `DTEND:${dt(end)}`,
      `SUMMARY:${esc(e.title || 'Ticket-Termin')}`,
      e.description ? `DESCRIPTION:${esc(e.description)}` : '',
      e.location ? `LOCATION:${esc(e.location)}` : '',
      e.customer_email ? `ATTENDEE;CN=${esc(e.customer_name || '')}:mailto:${e.customer_email}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-${(e.tickets?.ticket_number || e.id.slice(0, 8))}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };



  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cursor, view]);

  const deptById = useMemo(() => Object.fromEntries(depts.map((d) => [d.id, d])), [depts]);

  const filtered = useMemo(() => events.filter((e) => {
    if (fDepts.size && (!e.department_id || !fDepts.has(e.department_id))) return false;
    if (fKinds.size && (!e.event_kind || !fKinds.has(e.event_kind))) return false;
    if (fStatus.size && (!e.appointment_status || !fStatus.has(e.appointment_status))) return false;
    return true;
  }), [events, fDepts, fKinds, fStatus]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, TicketEvent[]>();
    for (const e of filtered) {
      const key = format(new Date(e.start_at), 'yyyy-MM-dd');
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [filtered]);

  const gridDays = useMemo(() => {
    const from = view === 'month'
      ? startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
      : startOfWeek(cursor, { weekStartsOn: 1 });
    const to = view === 'month'
      ? endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
      : endOfWeek(cursor, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: from, end: to });
  }, [cursor, view]);

  const shift = (dir: -1 | 1) => {
    setCursor(view === 'month'
      ? (dir < 0 ? subMonths(cursor, 1) : addMonths(cursor, 1))
      : (dir < 0 ? subWeeks(cursor, 1) : addWeeks(cursor, 1)));
  };

  const toggle = <T,>(set: Set<T>, val: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    setter(next);
  };

  const statusOptions = ['bestaetigung_ausstehend', 'bestaetigt', 'abgelehnt', 'bestaetigung_abgelaufen', 'geplant'];

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Ticket-Kalender</h1>
          <Badge variant="secondary">{filtered.length}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant={view === 'month' ? 'default' : 'outline'} onClick={() => setView('month')}>Monat</Button>
          <Button size="sm" variant={view === 'week' ? 'default' : 'outline'} onClick={() => setView('week')}>Woche</Button>
          <div className="mx-1 h-6 w-px bg-border" />
          <Button size="icon" variant="ghost" onClick={() => shift(-1)}><ChevronLeft className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setCursor(new Date())}>Heute</Button>
          <Button size="icon" variant="ghost" onClick={() => shift(1)}><ChevronRight className="w-4 h-4" /></Button>
          <div className="mx-2 text-[13px] font-medium min-w-[160px] text-center">
            {view === 'month'
              ? format(cursor, 'MMMM yyyy', { locale: de })
              : `${format(range.from, 'dd.MM.', { locale: de })} – ${format(range.to, 'dd.MM.yyyy', { locale: de })}`}
          </div>
          <Button size="icon" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <CardTitle className="text-[12px] text-muted-foreground font-medium">Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <FilterRow label="Abteilung">
            {depts.map((d) => (
              <Chip key={d.id} active={fDepts.has(d.id)} color={d.color ?? undefined} onClick={() => toggle(fDepts, d.id, setFDepts)}>
                {d.name}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Art">
            {KINDS.map((k) => (
              <Chip key={k} active={fKinds.has(k)} onClick={() => toggle(fKinds, k, setFKinds)}>{KIND_LABEL[k]}</Chip>
            ))}
          </FilterRow>
          <FilterRow label="Status">
            {statusOptions.map((s) => (
              <Chip key={s} active={fStatus.has(s)} onClick={() => toggle(fStatus, s, setFStatus)}>{s}</Chip>
            ))}
          </FilterRow>
        </CardContent>
      </Card>

      {/* Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b bg-muted/30 text-[11px] font-medium text-muted-foreground">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
              <div key={d} className="px-2 py-1.5">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-[minmax(112px,1fr)]">
            {gridDays.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDay.get(key) ?? [];
              const inMonth = view === 'week' || isSameMonth(day, cursor);
              return (
                <div
                  key={key}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverKey(key); }}
                  onDragLeave={() => setDragOverKey(k => k === key ? null : k)}
                  onDrop={(e) => onDropOnDay(key, e)}
                  className={`border-b border-r p-1 flex flex-col gap-0.5 min-h-[112px] transition-colors ${inMonth ? '' : 'bg-muted/20 text-muted-foreground'} ${dragOverKey === key ? 'bg-primary/10 ring-1 ring-inset ring-primary/40' : ''}`}
                >
                  <div className={`text-[11px] font-medium flex items-center justify-between ${isToday(day) ? 'text-primary' : ''}`}>
                    <span className={isToday(day) ? 'bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center' : ''}>
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 3 && <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</span>}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 3).map((e) => {
                      const dept = e.department_id ? deptById[e.department_id] : null;
                      const color = dept?.color ?? 'hsl(var(--primary))';
                      const tone = STATUS_TONE[e.appointment_status ?? ''] ?? STATUS_TONE.geplant;
                      const assignee = e.assigned_user_id ? userById[e.assigned_user_id] : null;
                      return (
                        <button
                          key={e.id}
                          draggable
                          onDragStart={(ev) => { ev.dataTransfer.setData('text/event-id', e.id); ev.dataTransfer.effectAllowed = 'move'; }}
                          onClick={() => setSelected(e)}
                          className={`w-full text-left text-[10.5px] leading-tight rounded px-1 py-0.5 ring-1 cursor-grab active:cursor-grabbing ${tone.bg} ${tone.text} ${tone.ring} hover:opacity-90 truncate`}
                          style={{ borderLeft: `3px solid ${color}` }}
                          title={`${e.title}${assignee ? ` · ${assignee.full_name || assignee.email}` : ''}`}
                        >
                          <span className="font-medium">{format(new Date(e.start_at), 'HH:mm')}</span>{' '}
                          <span className="truncate">{e.tickets?.ticket_number ?? ''} {e.title}</span>
                          {assignee && <span className="ml-1 opacity-70">· {(assignee.full_name || assignee.email || '').split(' ')[0]}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Slideover */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-[420px] sm:w-[480px]">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-[15px]">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: (selected.department_id ? deptById[selected.department_id]?.color : null) ?? 'hsl(var(--primary))' }}
                  />
                  {selected.title}
                </SheetTitle>
                <SheetDescription className="text-[12px]">
                  {selected.tickets?.ticket_number ?? 'Kein Ticket verknüpft'} · {KIND_LABEL[selected.event_kind ?? ''] ?? selected.event_kind}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-3 text-[13px]">
                <Row icon={Clock} label="Termin">
                  {format(new Date(selected.start_at), 'EEEE, dd.MM.yyyy · HH:mm', { locale: de })}
                  {selected.end_at && ` – ${format(new Date(selected.end_at), 'HH:mm')}`}
                </Row>

                <div className="flex flex-wrap gap-1.5">
                  {selected.appointment_status && (
                    <Badge variant="outline" className={STATUS_TONE[selected.appointment_status]?.text ?? ''}>
                      {selected.appointment_status}
                    </Badge>
                  )}
                  {selected.priority && (
                    <Badge className={PRIO_TONE[selected.priority] ?? ''}>{selected.priority}</Badge>
                  )}
                  {selected.department_id && deptById[selected.department_id] && (
                    <Badge variant="outline" style={{ borderColor: deptById[selected.department_id].color ?? undefined }}>
                      {deptById[selected.department_id].name}
                    </Badge>
                  )}
                </div>

                {selected.customer_name && (
                  <Row icon={User2} label="Kunde">{selected.customer_name}</Row>
                )}
                {selected.customer_email && (
                  <Row icon={Mail} label="E-Mail">
                    <a className="text-primary hover:underline" href={`mailto:${selected.customer_email}`}>{selected.customer_email}</a>
                  </Row>
                )}
                {selected.customer_phone && (
                  <Row icon={Phone} label="Telefon">
                    <a className="text-primary hover:underline" href={`tel:${selected.customer_phone}`}>{selected.customer_phone}</a>
                  </Row>
                )}
                {selected.description && (
                  <Row icon={AlertCircle} label="Beschreibung">
                    <p className="whitespace-pre-wrap text-muted-foreground text-[12px]">{selected.description}</p>
                  </Row>
                )}

                {selected.ticket_id && (
                  <Button asChild className="w-full mt-4">
                    <Link to={`/tickets/${selected.ticket_id}`}>
                      Ticket öffnen <ExternalLink className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground w-16 shrink-0">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  active, color, onClick, children,
}: { active: boolean; color?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-border'
      }`}
      style={color && !active ? { borderLeft: `3px solid ${color}` } : undefined}
    >
      {children}
    </button>
  );
}

function Row({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-[13px]">{children}</div>
      </div>
    </div>
  );
}
