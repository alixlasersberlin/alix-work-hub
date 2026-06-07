import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, Ban, Clock } from 'lucide-react';

interface LogRow {
  id: string;
  external_ticket_id: string | null;
  direction: string | null;
  action: string | null;
  status: string | null;
  error_message: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  success: number;
  errors: number;
  blocked: number;
  lastSync: string | null;
  ticketsTotal: number;
  ticketsSyncedToday: number;
}

const STATUS_STYLE: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  error: 'bg-destructive/10 text-destructive border-destructive/30',
  blocked: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  skipped: 'bg-muted text-muted-foreground border-border',
};

export default function TicketsSyncMonitor() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [{ data: logRows }, totalCount, successCount, errorCount, blockedCount, last, ticketsCount, syncedToday] = await Promise.all([
      supabase.from('ticket_sync_logs').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('ticket_sync_logs').select('id', { count: 'exact', head: true }),
      supabase.from('ticket_sync_logs').select('id', { count: 'exact', head: true }).eq('status', 'success'),
      supabase.from('ticket_sync_logs').select('id', { count: 'exact', head: true }).eq('status', 'error'),
      supabase.from('ticket_sync_logs').select('id', { count: 'exact', head: true }).eq('status', 'blocked'),
      supabase.from('ticket_sync_logs').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('tickets').select('id', { count: 'exact', head: true }),
      supabase.from('tickets').select('id', { count: 'exact', head: true }).gte('last_outbound_sync_at', startOfDay.toISOString()),
    ]);

    setLogs((logRows as LogRow[]) ?? []);
    setStats({
      total: totalCount.count ?? 0,
      success: successCount.count ?? 0,
      errors: errorCount.count ?? 0,
      blocked: blockedCount.count ?? 0,
      lastSync: last.data?.created_at ?? null,
      ticketsTotal: ticketsCount.count ?? 0,
      ticketsSyncedToday: syncedToday.count ?? 0,
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
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
            AlixWork ist Master-System. AlixSmart darf bestehende Tickets nicht mehr ändern.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Aktualisieren
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Tickets gesamt" value={stats?.ticketsTotal ?? 0} icon={<RefreshCw className="w-4 h-4 text-primary" />} />
        <KpiCard label="Heute synchronisiert" value={stats?.ticketsSyncedToday ?? 0} icon={<RefreshCw className="w-4 h-4 text-sky-400" />} />
        <KpiCard label="Sync-Vorgänge" value={stats?.total ?? 0} icon={<Clock className="w-4 h-4 text-muted-foreground" />} />
        <KpiCard label="Erfolgreich" value={stats?.success ?? 0} icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} />
        <KpiCard label="Fehler" value={stats?.errors ?? 0} icon={<AlertTriangle className="w-4 h-4 text-destructive" />} />
        <KpiCard label="Blockiert (Konflikt)" value={stats?.blocked ?? 0} icon={<Ban className="w-4 h-4 text-amber-400" />} />
      </div>

      <Card className="p-4">
        <div className="text-xs text-muted-foreground mb-2">
          Letzte Synchronisation:{' '}
          <span className="text-foreground">
            {stats?.lastSync ? new Date(stats.lastSync).toLocaleString('de-DE') : '—'}
          </span>
        </div>
      </Card>

      <Card>
        <div className="p-4 border-b border-border">
          <h2 className="font-display font-semibold">Letzte 100 Logeinträge</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zeitpunkt</TableHead>
              <TableHead>Richtung</TableHead>
              <TableHead>Aktion</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fehler / Hinweis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {loading ? 'Lade…' : 'Keine Einträge vorhanden.'}
                </TableCell>
              </TableRow>
            )}
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString('de-DE')}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{l.direction || '—'}</Badge>
                </TableCell>
                <TableCell className="text-xs">{l.action || '—'}</TableCell>
                <TableCell className="font-mono text-xs">{l.external_ticket_id || '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${STATUS_STYLE[l.status || ''] || ''}`}>
                    {l.status || '—'}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                  {l.error_message || '—'}
                </TableCell>
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
