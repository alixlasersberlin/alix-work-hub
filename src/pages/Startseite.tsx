import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Ticket as TicketIcon,
  ArrowRight,
  Inbox,
  Flame,
  Clock,
  CheckCircle2,
  Sparkles,
  UserCheck,
  Users,
  History as HistoryIcon,
  CalendarDays,
  ListTodo,
  Bell,
  FileSearch,
  FolderOpen,
  Truck,
  Receipt,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';

interface TicketRow {
  id: string;
  title: string | null;
  status: string;
  priority: string;
  customer_name: string | null;
  company_name: string | null;
  order_number: string | null;
  category: string | null;
  department: string | null;
  sla_status: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string | null;
  due_at: string | null;
}

interface EventRow {
  id: string;
  title: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  location: string | null;
  customer_name: string | null;
  appointment_status: string;
}

interface TaskRow {
  id: string;
  title: string;
  due_date: string;
  status: string;
  priority: number;
  customer_name: string | null;
  case_id: string | null;
}

interface NotificationRow {
  id: string;
  title: string;
  message: string | null;
  category: string;
  priority: string;
  action_url: string | null;
  created_at: string;
  read_at: string | null;
}

const OPEN_STATUSES = ['open', 'offen', 'in-progress', 'in_bearbeitung', 'wartet_Kunde', 'wartet_kunde'];
const CLOSED_STATUSES = ['gelöst', 'geschlossen'];

function priorityRank(p: string) {
  switch (p) {
    case 'kritisch': return 0;
    case 'hoch': return 1;
    case 'normal': return 2;
    case 'niedrig': return 3;
    default: return 4;
  }
}

function priorityBadge(p: string) {
  const map: Record<string, string> = {
    kritisch: 'bg-red-500/15 text-red-400 border-red-500/30',
    hoch: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    normal: 'bg-muted text-muted-foreground border-border',
    niedrig: 'bg-muted text-muted-foreground border-border',
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${map[p] || map.normal}`}>{p || 'normal'}</span>;
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    open: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    offen: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    'in-progress': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    in_bearbeitung: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    wartet_Kunde: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    wartet_kunde: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    'gelöst': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    geschlossen: 'bg-muted text-muted-foreground border-border',
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${map[s] || map.open}`}>{s}</span>;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 14) return 'Mahlzeit';
  if (h < 18) return 'Guten Nachmittag';
  return 'Guten Abend';
}

function personalSummary(tickets: number, tasks: number, events: number, notifications: number) {
  if (tickets + tasks + events + notifications === 0) {
    return 'Dein Tag ist frei – nichts liegt aktuell bei dir. Perfekt für Follow-ups. 🌿';
  }
  const parts: string[] = [];
  if (events) parts.push(`${events} Termin${events === 1 ? '' : 'e'} heute`);
  if (tasks) parts.push(`${tasks} Aufgabe${tasks === 1 ? '' : 'n'}`);
  if (tickets) parts.push(`${tickets} Ticket${tickets === 1 ? '' : 's'}`);
  if (notifications) parts.push(`${notifications} neue Meldung${notifications === 1 ? '' : 'en'}`);
  return `Heute für dich: ${parts.join(' · ')}.`;
}

export default function Startseite() {
  const { user, userProfile } = useAuth() as any;
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [recent, setRecent] = useState<TicketRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const uid = user?.id;
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(todayStart); weekEnd.setDate(weekEnd.getDate() + 7);

      const ticketCols = 'id, title, status, priority, customer_name, company_name, order_number, category, department, sla_status, assigned_to, created_at, updated_at, due_at';

      const [openRes, recentRes, eventRes, taskRes, notifRes] = await Promise.all([
        supabase.from('tickets').select(ticketCols)
          .in('status', OPEN_STATUSES)
          .order('priority', { ascending: true })
          .order('created_at', { ascending: false })
          .limit(200),
        uid
          ? supabase.from('tickets').select(ticketCols)
              .eq('assigned_to', uid)
              .order('updated_at', { ascending: false, nullsFirst: false })
              .limit(10)
          : supabase.from('tickets').select(ticketCols)
              .order('updated_at', { ascending: false, nullsFirst: false })
              .limit(10),
        uid
          ? supabase.from('esc_events')
              .select('id, title, start_at, end_at, all_day, location, customer_name, appointment_status')
              .eq('assigned_user_id', uid)
              .is('deleted_at', null)
              .gte('start_at', todayStart.toISOString())
              .lt('start_at', weekEnd.toISOString())
              .order('start_at', { ascending: true })
              .limit(12)
          : Promise.resolve({ data: [] as any }),
        uid
          ? supabase.from('collect_tasks')
              .select('id, title, due_date, status, priority, customer_name, case_id')
              .eq('assigned_to', uid)
              .neq('status', 'done')
              .order('due_date', { ascending: true })
              .limit(10)
          : Promise.resolve({ data: [] as any }),
        uid
          ? supabase.from('app_notifications')
              .select('id, title, message, category, priority, action_url, created_at, read_at')
              .eq('user_id', uid)
              .is('read_at', null)
              .order('created_at', { ascending: false })
              .limit(8)
          : Promise.resolve({ data: [] as any }),
      ]);

      if (!cancelled) {
        setTickets((openRes.data as TicketRow[]) || []);
        setRecent((recentRes.data as TicketRow[]) || []);
        setEvents(((eventRes as any).data as EventRow[]) || []);
        setTasks(((taskRes as any).data as TaskRow[]) || []);
        setNotifications(((notifRes as any).data as NotificationRow[]) || []);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const myTickets = useMemo(
    () => tickets
      .filter(t => user && t.assigned_to === user.id)
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)),
    [tickets, user],
  );
  const unassigned = useMemo(
    () => tickets
      .filter(t => !t.assigned_to)
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)),
    [tickets],
  );

  const todayEvents = useMemo(() => {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return events.filter(e => new Date(e.start_at) <= end);
  }, [events]);
  const overdueTasks = tasks.filter(t => new Date(t.due_date) < new Date()).length;
  const myCritical = myTickets.filter(t => t.priority === 'kritisch').length;

  const displayName = userProfile?.first_name || userProfile?.display_name || user?.email?.split('@')[0] || 'Team';
  const roleLabel = userProfile?.role || userProfile?.department || null;

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in">
      {/* Hero – persönlich */}
      <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 lg:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> {greeting()},
            </p>
            <h1 className="text-2xl lg:text-4xl font-semibold tracking-tight mt-1">
              {displayName} 👋
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })}
              {roleLabel && <> · <span className="text-primary/90">{roleLabel}</span></>}
            </p>
            <p className="mt-3 text-base lg:text-lg text-foreground/85 max-w-3xl">
              {personalSummary(myTickets.length, tasks.length, todayEvents.length, notifications.length)}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button asChild size="lg" className="gap-2">
              <Link to="/tickets?assigned=me">
                <UserCheck className="w-4 h-4" /> Mein Arbeitsvorrat
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2">
              <Link to="/esc/kalender">
                <CalendarDays className="w-4 h-4" /> Mein Kalender
              </Link>
            </Button>
          </div>
        </div>

        {/* Persönliche KPI Chips */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <KpiChip icon={UserCheck} label="Meine Tickets" value={myTickets.length} tone={myCritical ? 'red' : 'primary'} />
          <KpiChip icon={ListTodo} label="Meine Aufgaben" value={tasks.length} tone={overdueTasks ? 'red' : 'amber'} />
          <KpiChip icon={CalendarDays} label="Termine heute" value={todayEvents.length} tone="primary" />
          <KpiChip icon={Bell} label="Neue Meldungen" value={notifications.length} tone={notifications.length ? 'amber' : 'muted'} />
        </div>
      </section>

      {/* Schnellzugriff */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <QuickLink to="/tickets?assigned=me" icon={TicketIcon} label="Meine Tickets" />
        <QuickLink to="/esc/kalender" icon={CalendarDays} label="Teamkalender" />
        <QuickLink to="/alixdocs" icon={FolderOpen} label="AlixDocs" />
        <QuickLink to="/detailsuche" icon={FileSearch} label="Detailsuche" />
        <QuickLink to="/tourenplanung" icon={Truck} label="Tourenplanung" />
        <QuickLink to="/finance/rechnungen" icon={Receipt} label="Rechnungen" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Meine Termine */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="w-5 h-5 text-primary" /> Meine Termine
                <Badge variant="outline" className="ml-1">{events.length}</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Heute und die nächsten 7 Tage.</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 shrink-0">
              <Link to="/esc/kalender">Kalender <ArrowRight className="w-3.5 h-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Keine Termine für dich geplant. 🗓️</p>
            ) : events.map(e => (
              <Link
                key={e.id}
                to="/esc/kalender"
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <div className="text-center shrink-0 w-14">
                  <p className="text-[10px] uppercase text-muted-foreground">
                    {format(new Date(e.start_at), 'EEE d.MM', { locale: de })}
                  </p>
                  <p className="text-sm font-semibold">
                    {e.all_day ? 'ganztg.' : format(new Date(e.start_at), 'HH:mm')}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{e.title || 'Termin'}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {e.customer_name || '—'}{e.location && ` · ${e.location}`}
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Meine Aufgaben */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ListTodo className="w-5 h-5 text-primary" /> Meine Aufgaben
                <Badge variant="outline" className="ml-1">{tasks.length}</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {overdueTasks ? `${overdueTasks} überfällig – bitte zuerst erledigen.` : 'Offene Aufgaben, fälligste zuerst.'}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 shrink-0">
              <Link to="/finance/collect/aufgaben">Alle <ArrowRight className="w-3.5 h-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            ) : tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Keine offenen Aufgaben – stark! ✅</p>
            ) : tasks.map(t => {
              const overdue = new Date(t.due_date) < new Date();
              return (
                <Link
                  key={t.id}
                  to="/finance/collect/aufgaben"
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.customer_name || '—'}</p>
                  </div>
                  <span className={`text-[11px] shrink-0 ${overdue ? 'text-red-400' : 'text-muted-foreground'}`}>
                    {format(new Date(t.due_date), 'dd.MM.yyyy')}
                  </span>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Benachrichtigungen */}
      {notifications.length > 0 && (
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="w-5 h-5 text-primary" /> Für dich
                <Badge variant="outline" className="ml-1">{notifications.length}</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Ungelesene Benachrichtigungen.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {notifications.map(n => (
              <Link
                key={n.id}
                to={n.action_url || '#'}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  {n.message && <p className="text-xs text-muted-foreground truncate">{n.message}</p>}
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(n.created_at), { locale: de, addSuffix: true })}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Meine Tickets */}
      <TicketSection
        title="Meine offenen Tickets"
        icon={UserCheck}
        subtitle="Direkt an dich zugewiesen – höchste Priorität zuerst."
        tickets={myTickets}
        loading={loading}
        emptyText="Keine Tickets aktuell dir zugewiesen. Schnapp dir eines aus dem Team-Pool unten. 👇"
        cta="Alle meine Tickets"
        ctaHref="/tickets?assigned=me"
      />

      {/* Unzugewiesen */}
      <TicketSection
        title="Warten auf einen Bearbeiter"
        icon={Inbox}
        subtitle="Diese Tickets haben noch niemanden – übernimm eines und starte."
        tickets={unassigned.slice(0, 6)}
        totalCount={unassigned.length}
        loading={loading}
        emptyText="Alles zugewiesen – starke Team-Leistung! 🎯"
        cta="Alle unzugewiesenen"
        ctaHref="/tickets?filter=unassigned"
        accent
      />

      {/* Mein Verlauf */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HistoryIcon className="w-5 h-5 text-primary" /> Zuletzt von dir bearbeitet
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Deine letzten Ticket-Aktivitäten.</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/tickets?assigned=me">Alle anzeigen <ArrowRight className="w-3.5 h-3.5" /></Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Noch keine Aktivitäten.</p>
          ) : recent.map(t => (
            <Link
              key={t.id}
              to={`/tickets/${t.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {CLOSED_STATUSES.includes(t.status)
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    : <TicketIcon className="w-4 h-4 text-primary shrink-0" />}
                  <span className="text-sm font-medium truncate">{t.title || 'Ohne Titel'}</span>
                  {statusBadge(t.status)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {t.company_name || t.customer_name || '—'}
                  {t.order_number && ` · Auftrag ${t.order_number}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] text-muted-foreground">
                  {t.updated_at ? formatDistanceToNow(new Date(t.updated_at), { locale: de, addSuffix: true }) : '—'}
                </p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Team-Kontext (klein) */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <Users className="w-4 h-4" />
        <span>Team gesamt: {tickets.length} offene Tickets</span>
        <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-red-400" /> {tickets.filter(t => t.priority === 'kritisch').length} kritisch</span>
        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {tickets.filter(t => t.sla_status === 'breach').length} SLA-verletzt</span>
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link to="/tickets/dashboard">Team-Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-3 hover:border-primary/50 hover:bg-primary/5 transition-colors"
    >
      <Icon className="w-4 h-4 text-primary shrink-0" />
      <span className="text-sm font-medium truncate">{label}</span>
    </Link>
  );
}

function KpiChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone: 'primary' | 'amber' | 'red' | 'muted';
}) {
  const toneMap = {
    primary: 'border-primary/40 bg-primary/10 text-primary',
    amber: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
    red: 'border-red-500/40 bg-red-500/10 text-red-400',
    muted: 'border-border bg-muted/40 text-muted-foreground',
  } as const;
  return (
    <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${toneMap[tone]}`}>
      <Icon className="w-5 h-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide opacity-80">{label}</p>
        <p className="text-2xl font-semibold leading-tight">{value}</p>
      </div>
    </div>
  );
}

function TicketSection({
  title,
  subtitle,
  icon: Icon,
  tickets,
  loading,
  emptyText,
  cta,
  ctaHref,
  totalCount,
  accent,
}: {
  title: string;
  subtitle: string;
  icon: any;
  tickets: TicketRow[];
  loading: boolean;
  emptyText: string;
  cta: string;
  ctaHref: string;
  totalCount?: number;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? 'border-primary/30 bg-primary/[0.03]' : 'border-border'}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Icon className="w-5 h-5 text-primary" />
            {title}
            <Badge variant="outline" className="ml-1">{totalCount ?? tickets.length}</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <Button asChild variant="ghost" size="sm" className="gap-1 shrink-0">
          <Link to={ctaHref}>{cta} <ArrowRight className="w-3.5 h-3.5" /></Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{emptyText}</p>
        ) : tickets.map(t => (
          <Link
            key={t.id}
            to={`/tickets/${t.id}`}
            className="block rounded-lg border border-border/60 bg-card/40 px-3 py-3 hover:border-primary/50 hover:bg-primary/5 transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{t.title || 'Ohne Titel'}</span>
                  {priorityBadge(t.priority)}
                  {statusBadge(t.status)}
                  {t.sla_status === 'breach' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border bg-red-500/15 text-red-400 border-red-500/30">SLA ⚠</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {t.company_name || t.customer_name || '—'}
                  {t.order_number && ` · Auftrag ${t.order_number}`}
                  {t.category && ` · ${t.category}`}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Erstellt {formatDistanceToNow(new Date(t.created_at), { locale: de, addSuffix: true })}
                  {t.due_at && ` · Fällig ${formatDistanceToNow(new Date(t.due_at), { locale: de, addSuffix: true })}`}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
