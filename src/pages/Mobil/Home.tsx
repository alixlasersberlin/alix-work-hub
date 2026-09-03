/**
 * ALIX MOBILE COMMAND CENTER – Startbildschirm (Prompt 6).
 *
 * Kartenhierarchie: kritische Alerts → persönlicher Arbeitsbereich →
 * offene Vorgänge → Team → KPIs → Schnellzugriff.
 * Alle Zahlen stammen aus einem einzigen serverseitigen Snapshot (RPC).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  AlertTriangle, MessageSquare, Ticket, Inbox, Timer, Users, Search, Plus,
  Loader2, RefreshCw, WifiOff, CheckCircle2, ArrowRightLeft, BellRing, Cpu,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/hooks/emp/useOnlineStatus';
import { cacheGet, cacheSet, greeting } from '@/lib/mobil/utils';
import { haptic } from '@/lib/mobil/haptics';
import {
  MobilPage, SectionLabel, MobilCard, Pill, PillRow, PrioBadge, StatusChip,
  ListSkeleton, GridSkeleton, EmptyState, ErrorState, PullToRefresh, QuickTile,
} from '@/components/mobil/ui';
import {
  fetchCommandSnapshot, fetchCcFlags, fetchSlaThresholds, slaState, SLA_LABEL,
  minutesLabel, workloadScore, PRESENCE_LABEL, fetchMyPresence, setMyPresence,
  touchPresence, PRESENCE_STATES, logMobileAudit,
  type CommandSnapshot, type CcFlags, type SlaKey, type PriorityItem,
} from '@/lib/mobil/command';
import { toast } from 'sonner';

type Filter = 'ALLE' | 'MEINE' | 'P1' | 'P2' | 'UEBERFAELLIG' | 'NICHT_ZUGEWIESEN';

const FILTERS: Filter[] = ['ALLE', 'MEINE', 'P1', 'P2', 'UEBERFAELLIG', 'NICHT_ZUGEWIESEN'];
const FILTER_LABEL: Record<Filter, string> = {
  ALLE: 'Alle', MEINE: 'Meine', P1: 'P1', P2: 'P2',
  UEBERFAELLIG: 'Überfällig', NICHT_ZUGEWIESEN: 'Nicht zugewiesen',
};

export default function MobilHome() {
  const { profile, user } = useAuth();
  const nav = useNavigate();
  const online = useOnlineStatus();
  const [snap, setSnap] = useState<CommandSnapshot | null>(cacheGet<CommandSnapshot>('ccSnapshot') ?? null);
  const [flags, setFlags] = useState<CcFlags | null>(null);
  const [sla, setSla] = useState<Record<SlaKey, number> | null>(null);
  const [loading, setLoading] = useState(!snap);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALLE');
  const [presence, setPresence] = useState<string>('OFFLINE');
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await fetchCommandSnapshot();
      setSnap(s);
      cacheSet('ccSnapshot', s);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Command Center konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetchCcFlags().then(setFlags).catch(() => setFlags(null));
    fetchSlaThresholds().then(setSla).catch(() => setSla(null));
  }, [load]);

  // Presence: Heartbeat + eigener Status
  useEffect(() => {
    if (!user?.id) return;
    touchPresence(user.id).catch(() => {});
    fetchMyPresence(user.id).then((p) => setPresence(p?.status ?? 'ONLINE')).catch(() => {});
    const iv = window.setInterval(() => { touchPresence(user.id).catch(() => {}); }, 120000);
    return () => window.clearInterval(iv);
  }, [user?.id]);

  // Realtime – alle relevanten Kennzahlen, gebündelt & entprellt (kein Polling-Sturm)
  useEffect(() => {
    const schedule = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(load, 1200);
    };
    const ch = supabase
      .channel('mobil-command-center')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ac_conversations' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_escalations' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ac_user_presence' }, schedule)
      .subscribe();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      supabase.removeChannel(ch);
    };
  }, [load]);

  const name = (profile?.full_name || profile?.email || '').split(' ')[0];

  const items = useMemo(() => {
    const all = snap?.priority_items ?? [];
    if (!sla) return all;
    return all.filter((i) => {
      switch (filter) {
        case 'MEINE': return i.assigned_to === user?.id;
        case 'P1': return (i.prio || '').toUpperCase() === 'P1';
        case 'P2': return (i.prio || '').toUpperCase() === 'P2';
        case 'NICHT_ZUGEWIESEN': return !i.assigned_to;
        case 'UEBERFAELLIG': {
          const st = slaState(i.prio, i.waiting_minutes, sla);
          return st === 'UEBERFAELLIG' || st === 'KRITISCH';
        }
        default: return true;
      }
    });
  }, [snap, filter, sla, user?.id]);

  /** Briefing ausschliesslich aus echten Snapshot-Zahlen. */
  const brief = useMemo(() => {
    if (!snap) return null;
    const parts: string[] = [];
    parts.push(`${snap.counts.unread} ungelesene Nachricht${snap.counts.unread === 1 ? '' : 'en'}.`);
    if (snap.counts.p1p2 > 0) parts.push(`${snap.counts.p1p2} P1/P2-Fälle offen.`);
    if (snap.counts.unanswered > 0) parts.push(`${snap.counts.unanswered} Kunden warten auf eine Antwort.`);
    if (snap.tickets.overdue > 0) parts.push(`${snap.tickets.overdue} Tickets sind überfällig.`);
    if (snap.escalations > 0) parts.push(`${snap.escalations} aktive Eskalation${snap.escalations === 1 ? '' : 'en'}.`);
    if (snap.reminders_due > 0) parts.push(`${snap.reminders_due} Wiedervorlage${snap.reminders_due === 1 ? '' : 'n'} fällig.`);
    if (parts.length === 1 && snap.counts.unread === 0) return 'Aktuell sind keine offenen kritischen Vorgänge erfasst.';
    return parts.join(' ');
  }, [snap]);

  const changePresence = async (s: string) => {
    if (!user?.id) return;
    try {
      await setMyPresence(user.id, s);
      setPresence(s);
      haptic('light');
      toast.success(`Status: ${PRESENCE_LABEL[s] ?? s}`);
    } catch { toast.error('Status konnte nicht gesetzt werden.'); }
  };

  const takeOver = async (item: PriorityItem) => {
    if (!user?.id) return;
    const { error: e } = await (supabase as any).from('ac_conversations')
      .update({ assigned_to: user.id, assigned_at: new Date().toISOString() }).eq('id', item.id);
    if (e) { haptic('error'); toast.error('Übernahme fehlgeschlagen.'); return; }
    await logMobileAudit('ASSIGNMENT_CHANGED_MOBILE', { assigned_to: user.id, source: 'command_center' }, item.id);
    haptic('success');
    toast.success('Vorgang übernommen.');
    load();
  };

  return (
    <PullToRefresh onRefresh={load} refreshing={loading}>
      <MobilPage>
        {/* Kopf */}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight truncate">
              {greeting()}{name ? `, ${name}` : ''}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(), 'EEEE, dd.MM.yyyy')}
              {snap && <> · Stand {format(new Date(snap.generated_at), 'HH:mm')} Uhr</>}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={load} aria-label="Aktualisieren">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
          </Button>
        </header>

        {!online && (
          <MobilCard tone="warning" className="p-3">
            <div className="flex items-center gap-2 text-xs">
              <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
              <span>Offline – letzter bekannter Stand{snap ? ` von ${format(new Date(snap.generated_at), 'HH:mm')} Uhr` : ''}.</span>
            </div>
          </MobilCard>
        )}

        {error && <ErrorState hint={error} onRetry={load} />}

        {/* 1. Jetzt wichtig – operative Lage in einem Blick */}
        {snap && (snap.counts.p1p2 > 0 || snap.escalations > 0 || snap.tickets.overdue > 0) && (
          <MobilCard tone="critical" className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden /> Jetzt wichtig
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {snap.counts.p1p2 > 0 && <StatusChip tone="critical" icon={AlertTriangle}>{snap.counts.p1p2} kritische Vorgänge</StatusChip>}
              {snap.counts.unanswered > 0 && <StatusChip tone="warning" icon={Timer}>{snap.counts.unanswered} unbeantwortet</StatusChip>}
              {snap.escalations > 0 && <StatusChip tone="critical" icon={BellRing}>{snap.escalations} Eskalationen</StatusChip>}
              {snap.tickets.overdue > 0 && <StatusChip tone="warning" icon={Ticket}>{snap.tickets.overdue} Tickets überfällig</StatusChip>}
            </div>
          </MobilCard>
        )}

        {/* 2. Kennzahlen */}
        <section>
          <SectionLabel>Überblick</SectionLabel>
          {loading && !snap ? (
            <GridSkeleton />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Kpi v={snap?.counts.unread ?? 0} l="Neue Nachrichten" to="/mobil/inbox" icon={MessageSquare} />
              <Kpi v={snap?.counts.p1p2 ?? 0} l="P1 / P2" to="/mobil/inbox?prio=krit" icon={AlertTriangle} tone={(snap?.counts.p1p2 ?? 0) > 0 ? 'crit' : undefined} />
              <Kpi v={snap?.counts.unanswered ?? 0} l="Unbeantwortet" to="/mobil/inbox?f=unanswered" icon={Timer} />
              <Kpi v={snap?.tickets.open ?? 0} l="Offene Tickets" to="/mobil/tickets" icon={Ticket} />
              <Kpi v={snap?.escalations ?? 0} l="Eskalationen" to="/mobil/admin/eskalationen" icon={BellRing} tone={(snap?.escalations ?? 0) > 0 ? 'crit' : undefined} />
              <Kpi v={snap?.counts.unassigned ?? 0} l="Nicht zugewiesen" to="/mobil/inbox?f=unassigned" icon={Inbox} />
            </div>
          )}
        </section>

        {/* 3. Briefing */}
        {flags?.ai_daily_brief_enabled !== false && brief && (
          <MobilCard className="p-4">
            <SectionLabel>Mein Briefing</SectionLabel>
            <p className="text-sm leading-relaxed">{brief}</p>
          </MobilCard>
        )}

        {/* 4. Meine Arbeit */}
        <MobilCard className="p-4 space-y-3">
          <SectionLabel>Meine Arbeit</SectionLabel>
          <div className="grid grid-cols-3 text-center">
            <MiniNum v={snap?.counts.mine ?? 0} l="Chats" onClick={() => nav('/mobil/inbox?f=mine')} />
            <MiniNum v={snap?.tickets.mine ?? 0} l="Tickets" onClick={() => nav('/mobil/tickets?tab=MEINE')} />
            <MiniNum v={snap?.reminders_due ?? 0} l="Wiedervorlagen" onClick={() => nav('/mobil/wiedervorlagen')} />
          </div>
          <PillRow>
            {PRESENCE_STATES.map((s) => (
              <Pill key={s} active={presence === s} onClick={() => changePresence(s)}>{PRESENCE_LABEL[s]}</Pill>
            ))}
          </PillRow>
        </MobilCard>

        {/* 5. Vorgangsliste */}
        <section className="space-y-2">
          <SectionLabel action={loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : undefined}>
            Offene Vorgänge
          </SectionLabel>
          <PillRow>
            {FILTERS.map((f) => (
              <Pill key={f} active={filter === f} onClick={() => setFilter(f)}>{FILTER_LABEL[f]}</Pill>
            ))}
          </PillRow>

          {loading && !snap && <ListSkeleton rows={3} height={112} />}

          {items.length === 0 && !loading && (
            <EmptyState
              icon={CheckCircle2}
              title="Nichts Offenes in dieser Auswahl"
              hint="Neue Vorgänge erscheinen hier automatisch."
            />
          )}

          {items.map((i) => {
            const st = sla ? slaState(i.prio, i.waiting_minutes, sla) : 'IM_ZEITPLAN';
            const crit = st === 'UEBERFAELLIG' || st === 'KRITISCH';
            return (
              <MobilCard key={i.id} tone={crit ? 'critical' : 'default'} className="p-3.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <PrioBadge prio={i.prio} />
                  {i.category && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{i.category}</span>}
                  <span className={`ml-auto text-[11px] ${crit ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                    {SLA_LABEL[st]} · {minutesLabel(i.waiting_minutes)}
                  </span>
                </div>
                <div className="mt-1.5 font-semibold text-sm truncate">{i.title}</div>
                {i.preview && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{i.preview}</div>}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="h-10 flex-1" onClick={() => { haptic('light'); nav(`/mobil/inbox/${i.id}`); }}>Öffnen</Button>
                  {i.assigned_to !== user?.id && (
                    <Button size="sm" variant="outline" className="h-10 flex-1" onClick={() => takeOver(i)}>Übernehmen</Button>
                  )}
                </div>
              </MobilCard>
            );
          })}
        </section>

        {/* 6. Team */}
        {snap?.is_supervisor && flags?.team_presence_enabled !== false && (
          <MobilCard className="p-4 space-y-2">
            <SectionLabel action={<Link to="/mobil/supervisor" className="text-xs text-primary font-medium">Supervisor →</Link>}>
              Team
            </SectionLabel>
            {snap.team.length === 0 && <div className="text-sm text-muted-foreground">Keine aktiven Mitarbeiter erfasst.</div>}
            {snap.team.slice(0, 8).map((m) => {
              const w = workloadScore(m);
              return (
                <div key={m.user_id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <span className="h-8 w-8 shrink-0 rounded-full bg-muted text-[11px] font-semibold flex items-center justify-center">
                    {(m.name || '?').split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{m.name || 'Unbenannt'}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {PRESENCE_LABEL[m.status] ?? m.status} · {m.chats} Chats · {m.p1p2} P1/P2 · {m.tickets} Tickets
                    </div>
                  </div>
                  <StatusChip tone={w.level === 'HOCH' ? 'critical' : w.level === 'MITTEL' ? 'warning' : 'neutral'}>
                    {w.level}
                  </StatusChip>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground pt-1">Nur operative Arbeitsverteilung – keine Leistungsbewertung.</p>
          </MobilCard>
        )}

        {/* 7. Schnellzugriff */}
        <section>
          <SectionLabel>Schnellzugriff</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            <QuickTile to="/mobil/inbox" icon={MessageSquare} label="WhatsApp" />
            <QuickTile to="/mobil/magic-suche?typ=kunde" icon={Search} label="Kunde" />
            <QuickTile to="/mobil/magic-suche?typ=geraet" icon={Cpu} label="Gerät" />
            <QuickTile to="/mobil/tickets" icon={Ticket} label="Tickets" />
            <QuickTile to="/mobil/uebergabe" icon={ArrowRightLeft} label="Übergabe" />
            <QuickTile to="/mobil/kpi" icon={Timer} label="Kennzahlen" />
          </div>
        </section>
      </MobilPage>
    </PullToRefresh>
  );
}

function Kpi({ v, l, to, icon: Icon, tone }: { v: number; l: string; to: string; icon: any; tone?: 'crit' }) {
  return (
    <Link to={to} onClick={() => haptic('light')} aria-label={`${l}: ${v}`}>
      <Card className={`rounded-2xl border-border/70 p-3 min-h-[88px] flex flex-col justify-between transition-transform duration-150 active:scale-[0.97] active:bg-muted/40 motion-reduce:transition-none motion-reduce:active:scale-100 ${tone === 'crit' ? 'border-destructive/45' : ''}`}>
        <Icon className={`h-4 w-4 ${tone === 'crit' ? 'text-destructive' : 'text-primary'}`} aria-hidden />
        <div>
          <div className="text-[22px] font-semibold leading-none tabular-nums">{v}</div>
          <div className="text-[10px] text-muted-foreground leading-tight mt-1">{l}</div>
        </div>
      </Card>
    </Link>
  );
}

function MiniNum({ v, l, onClick }: { v: number; l: string; onClick: () => void }) {
  return (
    <button onClick={() => { haptic('light'); onClick(); }} className="py-1 min-h-[48px]" aria-label={`${l}: ${v}`}>
      <div className="text-lg font-semibold tabular-nums">{v}</div>
      <div className="text-[11px] text-muted-foreground">{l}</div>
    </button>
  );
}

