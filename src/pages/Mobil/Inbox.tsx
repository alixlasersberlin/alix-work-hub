import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, RefreshCw, Inbox as InboxIcon, AlertTriangle } from 'lucide-react';
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
    <div
      className="p-3 space-y-3"
      onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }}
      onTouchEnd={(e) => {
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        if (dy > 90 && window.scrollY <= 0 && !refreshing) { setRefreshing(true); load(); }
      }}
    >
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold flex-1">ALIX INBOX</h1>
        {unreadTotal > 0 && (
          <Badge variant="secondary" className="tabular-nums">{unreadTotal}</Badge>
        )}
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => { setRefreshing(true); load(); }} aria-label="Aktualisieren">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-[11px]">
        <span className={`inline-flex items-center gap-1 ${live ? 'text-emerald-500' : 'text-muted-foreground'}`}>
          <span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
          {live ? 'LIVE' : 'verbinde …'}
        </span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 h-11"
          placeholder="Name, Firma, Nummer, Nachricht …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {CHIPS.map((c) => (
          <button
            key={c}
            onClick={() => toggleChip(c)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
              chips.includes(c)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted/40 text-muted-foreground border-border'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      )}

      {!loading && error && (
        <Card className="p-6 text-center space-y-3">
          <AlertTriangle className="h-6 w-6 mx-auto text-muted-foreground" />
          <div className="font-medium">Inbox konnte nicht geladen werden.</div>
          <Button onClick={() => { setLoading(true); load(); }}>ERNEUT VERSUCHEN</Button>
        </Card>
      )}

      {!loading && !error && filtered.length === 0 && (
        <Card className="p-8 text-center space-y-2">
          <InboxIcon className="h-6 w-6 mx-auto text-muted-foreground" />
          <div className="font-medium">Keine offenen Nachrichten</div>
          <div className="text-xs text-muted-foreground">
            Neue WhatsApp-Anfragen erscheinen hier automatisch.
          </div>
        </Card>
      )}

      {!loading && !error && filtered.map((c) => {
        const p = normPriority(c.priority);
        const dept = c.assigned_department || c.ac_channels?.department || '';
        return (
          <Card
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => nav(`/mobil/inbox/${c.id}`)}
            onKeyDown={(e) => { if (e.key === 'Enter') nav(`/mobil/inbox/${c.id}`); }}
            className={`p-3 space-y-1 active:bg-muted/40 ${PRIO_STYLE[p]}`}
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <span className={p === 'P1' ? 'text-destructive' : p === 'P2' ? 'text-amber-500' : 'text-muted-foreground'}>
                {p} · {PRIORITY_LABEL[p]}
              </span>
              {dept && <span className="text-muted-foreground">· {dept.toUpperCase()}</span>}
              {c.is_test && <Badge variant="outline" className="h-4 px-1 text-[9px]">TEST</Badge>}
              <span className="ml-auto font-normal text-muted-foreground">{relTime(c.last_message_at)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold truncate">{displayName(c)}</span>
              {!c.customer_id && (
                <Badge variant="outline" className="h-4 px-1 text-[9px]">Unbekannter Kontakt</Badge>
              )}
              {c.customer_match_required && (
                <Badge variant="outline" className="h-4 px-1 text-[9px] border-amber-500 text-amber-500">Mehrere Treffer</Badge>
              )}
            </div>

            <div className="text-xs text-muted-foreground truncate">
              {c.last_message_preview || '—'}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5">
              <span>{(c.ac_channels?.name || c.channel_type || 'WhatsApp').toString()}</span>
              <span>· {STATUS_LABEL[(c.inbox_status || 'NEW') as InboxStatus]}</span>
              {(c.unread_count ?? 0) > 0 && (
                <Badge className="ml-auto h-4 px-1.5 text-[10px]">{c.unread_count} ungelesen</Badge>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
