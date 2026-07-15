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
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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

function motivator(open: number, mine: number, critical: number) {
  if (open === 0) return 'Alles im grünen Bereich – keine offenen Tickets. Perfekter Moment für Follow-ups! 🌿';
  if (critical > 0) return `${critical} kritische${critical === 1 ? 's' : ''} Ticket${critical === 1 ? '' : 's'} braucht sofortige Aufmerksamkeit ⚡`;
  if (mine > 0) return `${mine} Ticket${mine === 1 ? '' : 's'} warten auf dich – Ärmel hoch und los! 💪`;
  return `${open} offene Tickets im Team – schnapp dir eins und mach den Unterschied 🚀`;
}

export default function Startseite() {
  const { user, userProfile } = useAuth() as any;
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [recent, setRecent] = useState<TicketRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      // Alle offenen Tickets (limit sinnvoll)
      const { data: openData } = await supabase
        .from('tickets')
        .select('id, title, status, priority, customer_name, company_name, order_number, category, department, sla_status, assigned_to, created_at, updated_at, due_at')
        .in('status', OPEN_STATUSES)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(200);

      // Zuletzt bearbeitete Tickets (Verlauf)
      const { data: recentData } = await supabase
        .from('tickets')
        .select('id, title, status, priority, customer_name, company_name, order_number, category, department, sla_status, assigned_to, created_at, updated_at, due_at')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(10);

      if (!cancelled) {
        setTickets((openData as TicketRow[]) || []);
        setRecent((recentData as TicketRow[]) || []);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

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
  const otherOpen = useMemo(
    () => tickets
      .filter(t => t.assigned_to && (!user || t.assigned_to !== user.id))
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)),
    [tickets, user],
  );

  const critical = tickets.filter(t => t.priority === 'kritisch').length;
  const slaBreach = tickets.filter(t => t.sla_status === 'breach').length;
  const displayName = userProfile?.first_name || userProfile?.display_name || user?.email?.split('@')[0] || 'Team';

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-fade-in">
      {/* Hero */}
      <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 lg:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> {greeting()},
            </p>
            <h1 className="text-2xl lg:text-4xl font-semibold tracking-tight mt-1">
              {displayName} 👋
            </h1>
            <p className="mt-3 text-base lg:text-lg text-foreground/85 max-w-3xl">
              {motivator(tickets.length, myTickets.length, critical)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild size="lg" className="gap-2">
              <Link to="/tickets">
                <TicketIcon className="w-4 h-4" /> Zur Ticket-Liste
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2">
              <Link to="/tickets/dashboard">
                <ArrowRight className="w-4 h-4" /> Dashboard
              </Link>
            </Button>
          </div>
        </div>

        {/* KPI Chips */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <KpiChip icon={Inbox} label="Offene Tickets" value={tickets.length} tone="primary" />
          <KpiChip icon={UserCheck} label="Meine Tickets" value={myTickets.length} tone="amber" />
          <KpiChip icon={Flame} label="Kritisch" value={critical} tone={critical ? 'red' : 'muted'} />
          <KpiChip icon={Clock} label="SLA-Verletzt" value={slaBreach} tone={slaBreach ? 'red' : 'muted'} />
        </div>
      </section>

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
        tickets={unassigned.slice(0, 8)}
        totalCount={unassigned.length}
        loading={loading}
        emptyText="Alles zugewiesen – starke Team-Leistung! 🎯"
        cta="Alle unzugewiesenen"
        ctaHref="/tickets?filter=unassigned"
        accent
      />

      {/* Team */}
      <TicketSection
        title="Im Team in Bearbeitung"
        icon={Users}
        subtitle="Was Kolleg:innen gerade bearbeiten – transparente Übersicht."
        tickets={otherOpen.slice(0, 6)}
        totalCount={otherOpen.length}
        loading={loading}
        emptyText="Aktuell keine anderen Tickets in Team-Bearbeitung."
        cta="Zur Ticket-Liste"
        ctaHref="/tickets"
      />

      {/* Verlauf */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HistoryIcon className="w-5 h-5 text-primary" /> Zuletzt bearbeitet
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Deine letzten Ticket-Aktivitäten im Team.</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/tickets">Alle anzeigen <ArrowRight className="w-3.5 h-3.5" /></Link>
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
    </div>
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
