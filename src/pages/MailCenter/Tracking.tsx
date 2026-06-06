import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Activity, Search, Send, CheckCircle2, Eye, MousePointerClick,
  AlertTriangle, ShieldAlert, Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type MailRow = {
  id: string;
  to_email: string;
  to_name: string | null;
  from_email: string | null;
  subject: string | null;
  status: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  created_at: string;
};

type EventRow = {
  message_id: string;
  event_type: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Entwurf',
  queued: 'In Warteschlange',
  sent: 'Gesendet',
  delivered: 'Zugestellt',
  delayed: 'Verzögert',
  opened: 'Geöffnet',
  clicked: 'Geklickt',
  bounced: 'Bounced',
  complained: 'Beschwerde',
  failed: 'Fehlgeschlagen',
  test_sent: 'Testversand',
};

function statusBadge(status: string | null) {
  const s = status ?? 'unknown';
  const variants: Record<string, string> = {
    sent: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    delivered: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    opened: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    clicked: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    bounced: 'bg-red-500/15 text-red-400 border-red-500/30',
    complained: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    failed: 'bg-red-500/15 text-red-400 border-red-500/30',
    draft: 'bg-muted text-muted-foreground border-border',
    test_sent: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  };
  return (
    <Badge variant="outline" className={variants[s] ?? 'bg-muted text-muted-foreground'}>
      {STATUS_LABEL[s] ?? s}
    </Badge>
  );
}

export default function MailCenterTracking() {
  const [rows, setRows] = useState<MailRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data: msgs } = await supabase
        .from('mail_messages')
        .select(
          'id,to_email,to_name,from_email,subject,status,sent_at,delivered_at,opened_at,clicked_at,bounced_at,created_at'
        )
        .order('created_at', { ascending: false })
        .limit(500);
      const ids = (msgs ?? []).map((m) => m.id);
      let evs: EventRow[] = [];
      if (ids.length) {
        const { data: ev } = await supabase
          .from('mail_events')
          .select('message_id,event_type,created_at')
          .in('message_id', ids)
          .order('created_at', { ascending: false });
        evs = (ev ?? []) as EventRow[];
      }
      if (mounted) {
        setRows((msgs ?? []) as MailRow[]);
        setEvents(evs);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const eventCounts = useMemo(() => {
    const map = new Map<string, { opens: number; clicks: number; last?: string; lastType?: string }>();
    for (const e of events) {
      const cur = map.get(e.message_id) ?? { opens: 0, clicks: 0 };
      if (e.event_type === 'email.opened') cur.opens += 1;
      if (e.event_type === 'email.clicked') cur.clicks += 1;
      if (!cur.last || e.created_at > cur.last) {
        cur.last = e.created_at;
        cur.lastType = e.event_type;
      }
      map.set(e.message_id, cur);
    }
    return map;
  }, [events]);

  const stats = useMemo(() => {
    const s = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 };
    for (const r of rows) {
      if (r.sent_at || ['sent', 'delivered', 'opened', 'clicked', 'bounced'].includes(r.status ?? '')) s.sent += 1;
      if (r.delivered_at || ['delivered', 'opened', 'clicked'].includes(r.status ?? '')) s.delivered += 1;
      if (r.opened_at || ['opened', 'clicked'].includes(r.status ?? '')) s.opened += 1;
      if (r.clicked_at || r.status === 'clicked') s.clicked += 1;
      if (r.bounced_at || r.status === 'bounced') s.bounced += 1;
      if (r.status === 'complained') s.complained += 1;
    }
    return s;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && (r.status ?? '') !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.to_email ?? '').toLowerCase().includes(q) ||
        (r.subject ?? '').toLowerCase().includes(q) ||
        (r.from_email ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, statusFilter, search]);

  const statCards = [
    { label: 'Gesendet', value: stats.sent, icon: Send },
    { label: 'Zugestellt', value: stats.delivered, icon: CheckCircle2 },
    { label: 'Geöffnet', value: stats.opened, icon: Eye },
    { label: 'Geklickt', value: stats.clicked, icon: MousePointerClick },
    { label: 'Bounces', value: stats.bounced, icon: AlertTriangle },
    { label: 'Beschwerden', value: stats.complained, icon: ShieldAlert },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-display font-semibold text-foreground">Tracking</h2>
        <p className="text-sm text-muted-foreground">
          Versandstatus, Öffnungen und Klicks aller E-Mails – live aus Resend.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="card-glow">
              <CardHeader className="pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {s.label}
                </CardTitle>
                <Icon className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-display font-bold text-foreground">{s.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="card-glow">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Empfänger, Betreff oder Absender suchen…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="sent">Gesendet</SelectItem>
                <SelectItem value="delivered">Zugestellt</SelectItem>
                <SelectItem value="opened">Geöffnet</SelectItem>
                <SelectItem value="clicked">Geklickt</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
                <SelectItem value="failed">Fehlgeschlagen</SelectItem>
                <SelectItem value="complained">Beschwerde</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Betreff</TableHead>
                  <TableHead>Absender</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Öffnungen</TableHead>
                  <TableHead className="text-right">Klicks</TableHead>
                  <TableHead>Bounce</TableHead>
                  <TableHead>Letztes Event</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <div className="flex justify-center py-8 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <Activity className="w-8 h-8 opacity-40 mb-2" />
                        <p className="text-sm">Keine Mails gefunden.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const ec = eventCounts.get(r.id);
                    const dt = r.sent_at ?? r.created_at;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {new Date(dt).toLocaleString('de-DE')}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="font-medium">{r.to_name || r.to_email}</div>
                          {r.to_name && <div className="text-xs text-muted-foreground">{r.to_email}</div>}
                        </TableCell>
                        <TableCell className="text-sm max-w-[280px] truncate">{r.subject}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.from_email}</TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="text-right">{ec?.opens ?? 0}</TableCell>
                        <TableCell className="text-right">{ec?.clicks ?? 0}</TableCell>
                        <TableCell>
                          {r.bounced_at ? (
                            <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/30">
                              Bounce
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {ec?.lastType ? `${ec.lastType.replace('email.', '')} · ${new Date(ec.last!).toLocaleString('de-DE')}` : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
