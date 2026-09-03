import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Inbox as InboxIcon } from 'lucide-react';
import { haptic } from '@/lib/mobil/haptics';
import {
  MobilPage, MobilCard, Pill, PillRow, PrioBadge, ListSkeleton,
  EmptyState, ErrorState, PullToRefresh,
} from '@/components/mobil/ui';
import {
  fetchConversations, sortConversations, normPriority, PRIORITY_LABEL,
  STATUS_LABEL, displayName, relTime, type ConversationRow, type InboxStatus,
} from '@/lib/inbox/api';

type Chip = 'ALLE' | 'NEU' | 'MEINE' | 'TECHNIK' | 'SALES' | 'PRIORITÄT' | 'WARTET' | 'UNGELESEN';
const CHIPS: Chip[] = ['ALLE', 'NEU', 'MEINE', 'TECHNIK', 'SALES', 'PRIORITÄT', 'WARTET', 'UNGELESEN'];

const PRIO_STYLE: Record<string, string> = {
  P1: 'border-l-4 border-l-destructive bg-destructive/[0.04]',
  P2: 'border-l-4 border-l-amber-500/80',
  P3: 'border-l-4 border-l-transparent',
  P4: 'border-l-4 border-l-transparent opacity-80',
};

export default function MobilInbox() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [chips, setChips] = useState<Chip[]>(['ALLE']);
  const [live, setLive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setError(false);
      const data = await fetchConversations({ search: debounced });
      setRows(data);
    } catch (e) {
      console.error('inbox load failed', e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debounced]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Realtime — sauberer Lifecycle, genau ein Channel
  useEffect(() => {
    const ch = supabase
      .channel('alix-inbox-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ac_conversations' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ac_messages' }, () => load())
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const toggleChip = (c: Chip) => {
    setChips((prev) => {
      if (c === 'ALLE') return ['ALLE'];
      const next = prev.filter((p) => p !== 'ALLE');
      return next.includes(c) ? (next.filter((p) => p !== c).length ? next.filter((p) => p !== c) : ['ALLE']) : [...next, c];
    });
  };

  const filtered = useMemo(() => {
    let list = rows;
    const has = (c: Chip) => chips.includes(c);
    if (!has('ALLE')) {
      list = list.filter((r) => {
        const dept = (r.assigned_department || r.ac_channels?.department || '').toUpperCase();
        const p = normPriority(r.priority);
        const checks: boolean[] = [];
        if (has('NEU')) checks.push(r.inbox_status === 'NEW');
        if (has('MEINE')) checks.push(!!user && r.assigned_to === user.id);
        if (has('TECHNIK')) checks.push(dept.includes('TECHNIK'));
        if (has('SALES')) checks.push(dept.includes('SALES'));
        if (has('PRIORITÄT')) checks.push(p === 'P1' || p === 'P2');
        if (has('WARTET')) checks.push(r.inbox_status === 'WAITING_CUSTOMER' || r.inbox_status === 'WAITING_INTERNAL');
        if (has('UNGELESEN')) checks.push((r.unread_count ?? 0) > 0);
        return checks.every(Boolean);
      });
    }
    return sortConversations(list);
  }, [rows, chips, user]);

  const unreadTotal = useMemo(
    () => rows.reduce((s, r) => s + (r.unread_count ?? 0), 0), [rows],
  );

  return (
    <PullToRefresh onRefresh={async () => { setRefreshing(true); await load(); }} refreshing={refreshing}>
      <MobilPage className="pt-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-[22px] font-semibold tracking-tight leading-tight">ALIX INBOX</h1>
            <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
              <span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-muted-foreground'}`} aria-hidden />
              <span className={live ? 'text-emerald-500' : 'text-muted-foreground'}>{live ? 'Live' : 'verbinde …'}</span>
              {unreadTotal > 0 && <span className="text-muted-foreground">· {unreadTotal} ungelesen</span>}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => { haptic('light'); setRefreshing(true); load(); }} aria-label="Aktualisieren">
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            className="pl-9 h-12 rounded-2xl"
            placeholder="Name, Firma, Nummer, Nachricht …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Inbox durchsuchen"
          />
        </div>

        <PillRow>
          {CHIPS.map((c) => (
            <Pill key={c} active={chips.includes(c)} onClick={() => toggleChip(c)}>{c}</Pill>
          ))}
        </PillRow>

        {loading && <ListSkeleton rows={4} height={104} />}

        {!loading && error && (
          <ErrorState hint="Inbox konnte nicht geladen werden." onRetry={() => { setLoading(true); load(); }} />
        )}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={InboxIcon}
            title="Keine offenen Nachrichten"
            hint="Neue WhatsApp-Anfragen erscheinen hier automatisch."
          />
        )}

        {!loading && !error && filtered.map((c) => {
          const p = normPriority(c.priority);
          const dept = c.assigned_department || c.ac_channels?.department || '';
          const unread = c.unread_count ?? 0;
          return (
            <MobilCard
              key={c.id}
              tone={p === 'P1' ? 'critical' : p === 'P2' ? 'warning' : 'default'}

              onClick={() => { haptic('light'); nav(`/mobil/inbox/${c.id}`); }}
              className={`p-3.5 space-y-1.5 ${PRIO_STYLE[p]}`}
            >
              <div className="flex items-center gap-2 text-[11px]">
                <PrioBadge prio={p} />
                {dept && <span className="text-muted-foreground uppercase tracking-wide">{dept}</span>}
                {c.is_test && <Badge variant="outline" className="h-4 px-1 text-[9px]">TEST</Badge>}
                <span className="ml-auto text-muted-foreground tabular-nums">{relTime(c.last_message_at)}</span>
              </div>

              <div className="flex items-center gap-2 min-w-0">
                <span className={`truncate ${unread > 0 ? 'font-semibold' : 'font-medium'}`}>{displayName(c)}</span>
                {!c.customer_id && <Badge variant="outline" className="h-4 px-1 text-[9px] shrink-0">Unbekannt</Badge>}
                {c.customer_match_required && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] border-amber-500 text-amber-500 shrink-0">Mehrere Treffer</Badge>
                )}
                {unread > 0 && (
                  <span className="ml-auto shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 tabular-nums">
                    {unread}
                  </span>
                )}
              </div>

              <div className={`text-xs line-clamp-2 ${unread > 0 ? 'text-foreground/80' : 'text-muted-foreground'}`}>
                {c.last_message_preview || '—'}
              </div>

              <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5">
                <span>{(c.ac_channels?.name || c.channel_type || 'WhatsApp').toString()}</span>
                <span>· {STATUS_LABEL[(c.inbox_status || 'NEW') as InboxStatus]}</span>
              </div>
            </MobilCard>
          );
        })}
      </MobilPage>
    </PullToRefresh>
  );
}

