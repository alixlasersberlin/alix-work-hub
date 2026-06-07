import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, Ban, Clock,
  ArrowUpRight, ArrowDownLeft, BellRing, Mail,
} from 'lucide-react';
import { toast } from 'sonner';

interface LogRow {
  id: string;
  ticket_id?: string | null;
  external_ticket_id: string | null;
  direction: string | null;
  action: string | null;
  status: string | null;
  error_message: string | null;
  response_code: number | null;
  attempt: number | null;
  created_at: string;
  ticket_number?: string | null;
}

interface Stats {
  pushSuccess: number;
  pushError: number;
  pollSuccess: number;
  pollError: number;
  blocked: number;
  lastSync: LogRow | null;
  ticketsTotal: number;
  ticketsSyncedToday: number;
}

const STATUS_STYLE: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  error: 'bg-destructive/10 text-destructive border-destructive/30',
  retry: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  blocked: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  skipped: 'bg-muted text-muted-foreground border-border',
};

const RANGE_HOURS: Record<string, number | null> = {
  '1h': 1, '24h': 24, '7d': 24 * 7, '30d': 24 * 30, all: null,
};

export default function TicketsSyncMonitor() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // filters
  const [range, setRange] = useState<keyof typeof RANGE_HOURS>('24h');
  const [direction, setDirection] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [action, setAction] = useState<string>('all');
  const [search, setSearch] = useState('');

  const sinceIso = useMemo(() => {
    const h = RANGE_HOURS[range];
    if (h === null) return null;
    return new Date(Date.now() - h * 3600_000).toISOString();
  }, [range]);

  async function load() {
    setLoading(true);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const inboundQ = supabase.from('ticket_sync_logs').select('*').order('created_at', { ascending: false }).limit(300);
    const outboundQ = supabase.from('ticket_outbound_sync_logs').select('*').order('created_at', { ascending: false }).limit(300);
    if (sinceIso) {
      inboundQ.gte('created_at', sinceIso);
      outboundQ.gte('created_at', sinceIso);
    }

    const sinceFilter = sinceIso ?? '1970-01-01T00:00:00Z';
    const countInbound = (st: string) =>
      supabase.from('ticket_sync_logs').select('id', { count: 'exact', head: true })
        .gte('created_at', sinceFilter).eq('status', st);
    const countOutbound = (st: string) =>
      supabase.from('ticket_outbound_sync_logs').select('id', { count: 'exact', head: true })
        .gte('created_at', sinceFilter).eq('status', st);


    const [
      { data: inboundRows },
      { data: outboundRows },
      pushOk, pushErr,
      pollOk, pollErr,
      blockedCount,
      ticketsCount, syncedToday,
    ] = await Promise.all([
      inboundQ,
      outboundQ,
      countOutbound('success'),
      countOutbound('error'),
      countInbound('success'),
      countInbound('error'),
      countInbound('blocked'),
      supabase.from('tickets').select('id', { count: 'exact', head: true }),
      supabase.from('tickets').select('id', { count: 'exact', head: true }).gte('last_outbound_sync_at', startOfDay.toISOString()),
    ]);

    const inbound: LogRow[] = ((inboundRows as any[]) ?? []).map((r) => ({ ...r, direction: r.direction || 'inbound' }));
    const outbound: LogRow[] = ((outboundRows as any[]) ?? []).map((r) => ({ ...r, direction: r.direction || 'outbound' }));
    const merged = [...inbound, ...outbound].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    // enrich with ticket_number for outbound (have ticket_id)
    const ticketIds = Array.from(new Set(merged.map((m) => m.ticket_id).filter(Boolean))) as string[];
    let ticketMap = new Map<string, string>();
    if (ticketIds.length) {
      const { data: tks } = await supabase.from('tickets').select('id, ticket_number').in('id', ticketIds);
      ticketMap = new Map((tks || []).map((t: any) => [t.id, t.ticket_number]));
    }
    const enriched = merged.map((m) => ({ ...m, ticket_number: m.ticket_id ? ticketMap.get(m.ticket_id) ?? null : null }));

    const lastSyncRow = enriched.find((r) => r.status === 'success') ?? null;

    setLogs(enriched);
    setStats({
      pushSuccess: pushOk.count ?? 0,
      pushError: pushErr.count ?? 0,
      pollSuccess: pollOk.count ?? 0,
      pollError: pollErr.count ?? 0,
      blocked: blockedCount.count ?? 0,
      lastSync: lastSyncRow,
      ticketsTotal: ticketsCount.count ?? 0,
      ticketsSyncedToday: syncedToday.count ?? 0,
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinceIso]);

  const actionsAvailable = useMemo(
    () => Array.from(new Set(logs.map((l) => l.action).filter(Boolean) as string[])).sort(),
    [logs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (direction !== 'all' && (l.direction || '') !== direction) return false;
      if (status !== 'all' && (l.status || '') !== status) return false;
      if (action !== 'all' && (l.action || '') !== action) return false;
      if (q) {
        const hay = `${l.external_ticket_id || ''} ${l.ticket_number || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, direction, status, action, search]);

  const errorLogs = useMemo(() => filtered.filter((l) => l.status === 'error').slice(0, 20), [filtered]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/tickets" className="hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Tickets
            </Link>
            <span>/</span>
            <span className="text-foreground">Synchronisation</span>
          </div>
          <h1 className="text-2xl font-display font-bold mt-1">Ticket-Synchronisation</h1>
          <p className="text-sm text-muted-foreground">
            AlixWork ⇄ AlixSmart · Push (outbound) und Polling (inbound) gemeinsam überwacht.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Aktualisieren
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard label="Push erfolgreich" value={stats?.pushSuccess ?? 0} icon={<ArrowUpRight className="w-4 h-4 text-emerald-400" />} />
        <KpiCard label="Push fehlgeschlagen" value={stats?.pushError ?? 0} icon={<ArrowUpRight className="w-4 h-4 text-destructive" />} />
        <KpiCard label="Polling erfolgreich" value={stats?.pollSuccess ?? 0} icon={<ArrowDownLeft className="w-4 h-4 text-emerald-400" />} />
        <KpiCard label="Polling fehlgeschlagen" value={stats?.pollError ?? 0} icon={<ArrowDownLeft className="w-4 h-4 text-destructive" />} />
        <KpiCard label="Blockiert (Konflikt)" value={stats?.blocked ?? 0} icon={<Ban className="w-4 h-4 text-amber-400" />} />
        <KpiCard label="Tickets gesamt" value={stats?.ticketsTotal ?? 0} icon={<RefreshCw className="w-4 h-4 text-primary" />} />
        <KpiCard label="Heute synchronisiert" value={stats?.ticketsSyncedToday ?? 0} icon={<Clock className="w-4 h-4 text-sky-400" />} />
      </div>

      {/* Last sync */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <div>
            <span className="text-muted-foreground">Letzte Synchronisation: </span>
            <span className="text-foreground font-medium">
              {stats?.lastSync ? new Date(stats.lastSync.created_at).toLocaleString('de-DE') : '—'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Richtung: </span>
            <Badge variant="outline" className="text-xs">{stats?.lastSync?.direction || '—'}</Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Aktion: </span>
            <span className="text-foreground">{stats?.lastSync?.action || '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Response-Code: </span>
            <span className="font-mono text-foreground">{stats?.lastSync?.response_code ?? '—'}</span>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <FilterField label="Zeitraum">
            <Select value={range} onValueChange={(v) => setRange(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Letzte 1 Stunde</SelectItem>
                <SelectItem value="24h">Letzte 24 Stunden</SelectItem>
                <SelectItem value="7d">Letzte 7 Tage</SelectItem>
                <SelectItem value="30d">Letzte 30 Tage</SelectItem>
                <SelectItem value="all">Gesamt</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Richtung">
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="inbound">Inbound (Polling)</SelectItem>
                <SelectItem value="outbound">Outbound (Push)</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="success">Erfolgreich</SelectItem>
                <SelectItem value="error">Fehler</SelectItem>
                <SelectItem value="retry">Retry</SelectItem>
                <SelectItem value="blocked">Blockiert</SelectItem>
                <SelectItem value="skipped">Übersprungen</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Aktion">
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {actionsAvailable.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Ticket / Ext. ID">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suche…" />
          </FilterField>
        </div>
      </Card>

      {/* Recent errors */}
      <Card>
        <div className="p-4 border-b border-border flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h2 className="font-display font-semibold">Letzte Fehler (max. 20)</h2>
          <Badge variant="outline" className="ml-auto text-xs">{errorLogs.length}</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zeitpunkt</TableHead>
              <TableHead>Richtung</TableHead>
              <TableHead>Aktion</TableHead>
              <TableHead>Ticket-Nr.</TableHead>
              <TableHead>External ID</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Versuch</TableHead>
              <TableHead>Fehler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errorLogs.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  Keine Fehler im gewählten Zeitraum.
                </TableCell>
              </TableRow>
            )}
            {errorLogs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString('de-DE')}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{l.direction || '—'}</Badge></TableCell>
                <TableCell className="text-xs">{l.action || '—'}</TableCell>
                <TableCell className="font-mono text-xs">{l.ticket_number || '—'}</TableCell>
                <TableCell className="font-mono text-xs">{l.external_ticket_id || '—'}</TableCell>
                <TableCell className="font-mono text-xs">{l.response_code ?? '—'}</TableCell>
                <TableCell className="text-xs">{l.attempt ?? '—'}</TableCell>
                <TableCell className="text-xs text-destructive max-w-md truncate" title={l.error_message || ''}>{l.error_message || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* All logs */}
      <Card>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display font-semibold">Sync-Logs ({filtered.length})</h2>
          <span className="text-xs text-muted-foreground">Auto-Refresh alle 30 s</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zeitpunkt</TableHead>
              <TableHead>Richtung</TableHead>
              <TableHead>Aktion</TableHead>
              <TableHead>Ticket-Nr.</TableHead>
              <TableHead>External ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Versuch</TableHead>
              <TableHead>Hinweis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  {loading ? 'Lade…' : 'Keine Einträge im gewählten Filter.'}
                </TableCell>
              </TableRow>
            )}
            {filtered.slice(0, 200).map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString('de-DE')}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{l.direction || '—'}</Badge></TableCell>
                <TableCell className="text-xs">{l.action || '—'}</TableCell>
                <TableCell className="font-mono text-xs">{l.ticket_number || '—'}</TableCell>
                <TableCell className="font-mono text-xs">{l.external_ticket_id || '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${STATUS_STYLE[l.status || ''] || ''}`}>{l.status || '—'}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{l.response_code ?? '—'}</TableCell>
                <TableCell className="text-xs">{l.attempt ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-md truncate" title={l.error_message || ''}>{l.error_message || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-display font-bold tabular-nums">{value}</p>
    </Card>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
