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
import { Badge } from '@/components/ui/badge';
import { useOnlineStatus } from '@/hooks/emp/useOnlineStatus';
import { cacheGet, cacheSet, greeting } from '@/lib/mobil/utils';
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
      toast.success(`Status: ${PRESENCE_LABEL[s] ?? s}`);
    } catch { toast.error('Status konnte nicht gesetzt werden.'); }
  };

  const takeOver = async (item: PriorityItem) => {
    if (!user?.id) return;
    const { error: e } = await (supabase as any).from('ac_conversations')
      .update({ assigned_to: user.id, assigned_at: new Date().toISOString() }).eq('id', item.id);
    if (e) { toast.error('Übernahme fehlgeschlagen.'); return; }
    await logMobileAudit('ASSIGNMENT_CHANGED_MOBILE', { assigned_to: user.id, source: 'command_center' }, item.id);
    toast.success('Vorgang übernommen.');
    load();
  };

  return (
    <div className="p-4 space-y-4">
      {/* Kopf */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">ALIXWORK</div>
          <h1 className="text-2xl font-bold leading-tight truncate">{greeting()}{name ? `, ${name}` : ''}</h1>
          <p className="text-xs text-muted-foreground">
            {format(new Date(), 'EEEE, dd.MM.yyyy')}
            {snap && <> · Stand {format(new Date(snap.generated_at), 'HH:mm')} Uhr</>}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={load} aria-label="Aktualisieren">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
        </Button>
      </div>

      {!online && (
        <Card className="p-3 border-amber-500/40 bg-amber-500/10 flex items-center gap-2 text-sm">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Offline – angezeigt wird der letzte bekannte Stand{snap ? ` von ${format(new Date(snap.generated_at), 'HH:mm')} Uhr` : ''}.</span>
        </Card>
      )}

      {error && <Card className="p-3 text-sm text-destructive border-destructive/40">{error}</Card>}

      {/* 1. Kritische Alerts */}
      {snap && (snap.counts.p1p2 > 0 || snap.escalations > 0) && (
        <Card className="p-4 border-destructive/50 bg-destructive/10">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4" /> Sofort prüfen
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {snap.counts.p1p2 > 0 && <Badge variant="destructive">{snap.counts.p1p2} × P1/P2</Badge>}
            {snap.escalations > 0 && <Badge variant="destructive">{snap.escalations} Eskalationen</Badge>}
            {snap.tickets.overdue > 0 && <Badge variant="outline">{snap.tickets.overdue} Tickets überfällig</Badge>}
          </div>
        </Card>
      )}

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Kpi v={snap?.counts.unread ?? 0} l="Neue Nachrichten" to="/mobil/inbox" icon={MessageSquare} />
        <Kpi v={snap?.counts.p1p2 ?? 0} l="P1 / P2" to="/mobil/inbox?prio=krit" icon={AlertTriangle} tone={(snap?.counts.p1p2 ?? 0) > 0 ? 'crit' : undefined} />
        <Kpi v={snap?.counts.unanswered ?? 0} l="Unbeantwortet" to="/mobil/inbox?f=unanswered" icon={Timer} />
        <Kpi v={snap?.tickets.open ?? 0} l="Offene Tickets" to="/mobil/tickets" icon={Ticket} />
        <Kpi v={snap?.escalations ?? 0} l="Eskalationen" to="/mobil/admin/eskalationen" icon={BellRing} tone={(snap?.escalations ?? 0) > 0 ? 'crit' : undefined} />
        <Kpi v={snap?.counts.unassigned ?? 0} l="Nicht zugewiesen" to="/mobil/inbox?f=unassigned" icon={Inbox} />
      </div>

      {/* 3. Mein Briefing */}
      {flags?.ai_daily_brief_enabled !== false && brief && (
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Mein Briefing</div>
          <p className="text-sm leading-relaxed">{brief}</p>
        </Card>
      )}

      {/* 4. Meine Arbeit */}
      <Card className="p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Meine Arbeit</div>
        <div className="grid grid-cols-3 text-center">
          <MiniNum v={snap?.counts.mine ?? 0} l="Chats" onClick={() => nav('/mobil/inbox?f=mine')} />
          <MiniNum v={snap?.tickets.mine ?? 0} l="Tickets" onClick={() => nav('/mobil/tickets?tab=MEINE')} />
          <MiniNum v={snap?.reminders_due ?? 0} l="Wiedervorlagen" onClick={() => nav('/mobil/wiedervorlagen')} />
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {PRESENCE_STATES.map((s) => (
            <button
              key={s}
              onClick={() => changePresence(s)}
              className={`px-2.5 py-1.5 rounded-full text-[11px] border min-h-[32px] ${
                presence === s ? 'border-primary bg-primary/15 text-primary font-semibold' : 'border-border text-muted-foreground'
              }`}
            >
              {PRESENCE_LABEL[s]}
            </button>
          ))}
        </div>
      </Card>

      {/* 5. Jetzt wichtig */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Jetzt wichtig</div>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs border min-h-[34px] ${
                filter === f ? 'border-primary bg-primary/15 text-primary font-semibold' : 'border-border text-muted-foreground'
              }`}
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>

        {items.length === 0 && !loading && (
          <Card className="p-5 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Keine unbeantworteten Vorgänge in dieser Auswahl.
          </Card>
        )}

        {items.map((i) => {
          const st = sla ? slaState(i.prio, i.waiting_minutes, sla) : 'IM_ZEITPLAN';
          const crit = st === 'UEBERFAELLIG' || st === 'KRITISCH';
          return (
            <Card key={i.id} className={`p-3 ${crit ? 'border-destructive/50' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={i.prio === 'P1' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {i.prio === 'P1' && <AlertTriangle className="h-3 w-3 mr-1" />}{i.prio}
                </Badge>
                {i.category && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{i.category}</span>}
                <span className={`ml-auto text-[11px] ${crit ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                  {SLA_LABEL[st]} · {minutesLabel(i.waiting_minutes)}
                </span>
              </div>
              <div className="mt-1 font-semibold text-sm truncate">{i.title}</div>
              {i.preview && <div className="text-xs text-muted-foreground line-clamp-2">{i.preview}</div>}
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="h-9 flex-1" onClick={() => nav(`/mobil/inbox/${i.id}`)}>Öffnen</Button>
                {i.assigned_to !== user?.id && (
                  <Button size="sm" variant="outline" className="h-9 flex-1" onClick={() => takeOver(i)}>Übernehmen</Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* 6. Team / Supervisor */}
      {snap?.is_supervisor && flags?.team_presence_enabled !== false && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Users className="h-3.5 w-3.5" /> Team
            </div>
            <Link to="/mobil/supervisor" className="text-xs text-primary">Supervisor →</Link>
          </div>
          {snap.team.length === 0 && <div className="text-sm text-muted-foreground">Keine aktiven Mitarbeiter erfasst.</div>}
          {snap.team.slice(0, 8).map((m) => {
            const w = workloadScore(m);
            return (
              <div key={m.user_id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                  m.status === 'ONLINE' ? 'bg-emerald-500' :
                  m.status === 'BESCHAEFTIGT' ? 'bg-amber-500' :
                  m.status === 'PAUSE' ? 'bg-sky-500' :
                  m.status === 'NICHT_VERFUEGBAR' ? 'bg-destructive' : 'bg-muted-foreground/40'
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{m.name || 'Unbenannt'}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {PRESENCE_LABEL[m.status] ?? m.status} · {m.chats} Chats · {m.p1p2} P1/P2 · {m.tickets} Tickets
                    {m.oldest_wait_minutes != null && <> · älteste {minutesLabel(m.oldest_wait_minutes)}</>}
                  </div>
                </div>
                <Badge variant={w.level === 'HOCH' ? 'destructive' : w.level === 'MITTEL' ? 'secondary' : 'outline'} className="text-[10px] shrink-0">
                  {w.level}
                </Badge>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground">Nur operative Arbeitsverteilung – keine Leistungsbewertung.</p>
        </Card>
      )}

      {/* 7. Schnellzugriff */}
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Schnellzugriff</div>
        <div className="grid grid-cols-3 gap-2">
          <Quick to="/mobil/inbox" icon={MessageSquare} label="WhatsApp" />
          <Quick to="/mobil/magic?typ=kunde" icon={Search} label="Kunde" />
          <Quick to="/mobil/magic?typ=geraet" icon={Cpu} label="Gerät" />
          <Quick to="/mobil/tickets" icon={Ticket} label="Tickets" />
          <Quick to="/mobil/uebergabe" icon={ArrowRightLeft} label="Übergabe" />
          <Quick to="/mobil/kpi" icon={Timer} label="Kennzahlen" />
        </div>
      </div>
    </div>
  );
}

function Kpi({ v, l, to, icon: Icon, tone }: { v: number; l: string; to: string; icon: any; tone?: 'crit' }) {
  return (
    <Link to={to}>
      <Card className={`p-3 min-h-[84px] flex flex-col justify-between active:bg-muted/40 ${tone === 'crit' ? 'border-destructive/50' : ''}`}>
        <Icon className={`h-4 w-4 ${tone === 'crit' ? 'text-destructive' : 'text-primary'}`} />
        <div>
          <div className="text-xl font-bold leading-none">{v}</div>
          <div className="text-[10px] text-muted-foreground leading-tight mt-1">{l}</div>
        </div>
      </Card>
    </Link>
  );
}

function MiniNum({ v, l, onClick }: { v: number; l: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="py-1 min-h-[48px]">
      <div className="text-lg font-bold">{v}</div>
      <div className="text-[11px] text-muted-foreground">{l}</div>
    </button>
  );
}

function Quick({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to}>
      <Card className="p-3 min-h-[72px] flex flex-col items-center justify-center gap-1 active:bg-muted/40">
        <Icon className="w-5 h-5 text-primary" />
        <span className="text-xs font-medium">{label}</span>
      </Card>
    </Link>
  );
}
