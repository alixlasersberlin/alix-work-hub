import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Cloud, RefreshCw, Play, Search, Filter, CheckCircle2, XCircle,
  Clock, AlertTriangle, Database, ArrowUpDown, Inbox, FileText, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const IMPORT_SOURCES = [
  { key: 'zoho_eu_1', label: 'Zoho Books EU 1', region: 'EU' },
  { key: 'zoho_eu_2', label: 'Zoho Books EU 2', region: 'EU' },
  { key: 'zoho_us_1', label: 'Zoho Books USA 1', region: 'US' },
] as const;

type SourceKey = typeof IMPORT_SOURCES[number]['key'];

interface SourceStats {
  total: number;
  success: number;
  failed: number;
  lastImport: string | null;
  lastSuccess: string | null;
  lastFailed: string | null;
}

interface ImportLog {
  id: string;
  source_system: string;
  external_customer_id: string | null;
  external_order_id: string | null;
  order_number: string | null;
  import_status: string;
  message: string | null;
  imported_by: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  pending: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30',
  failed: 'bg-destructive/15 text-destructive border-destructive/30',
  skipped: 'bg-muted text-muted-foreground border-border',
};

export default function ImportManagement() {
  const { isAdmin, hasAnyRole } = useAuth();
  const canWrite = isAdmin;
  const canRead = isAdmin || hasAnyRole(['Auftragsverwaltung', 'Read Only Audit']);

  const [sourceStats, setSourceStats] = useState<Record<SourceKey, SourceStats | null>>({
    zoho_eu_1: null, zoho_eu_2: null, zoho_us_1: null,
  });
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [triggerLoading, setTriggerLoading] = useState<string | null>(null);

  useEffect(() => {
    if (canRead) {
      fetchSourceStats();
      fetchLogs();
    }
  }, [canRead]);

  async function fetchSourceStats() {
    setLoading(true);
    const stats: Record<string, SourceStats> = {};
    for (const src of IMPORT_SOURCES) {
      const { data, count } = await supabase
        .from('order_import_logs')
        .select('*', { count: 'exact' })
        .eq('source_system', src.key)
        .order('created_at', { ascending: false })
        .limit(500);

      const rows = data || [];
      const successRows = rows.filter(r => r.import_status === 'success');
      const failedRows = rows.filter(r => r.import_status === 'failed');

      stats[src.key] = {
        total: count || rows.length,
        success: successRows.length,
        failed: failedRows.length,
        lastImport: rows[0]?.created_at || null,
        lastSuccess: successRows[0]?.created_at || null,
        lastFailed: failedRows[0]?.created_at || null,
      };
    }
    setSourceStats(stats as Record<SourceKey, SourceStats>);
    setLoading(false);
  }

  async function fetchLogs() {
    setLogsLoading(true);
    const { data } = await supabase
      .from('order_import_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setLogs(data || []);
    setLogsLoading(false);
  }

  async function triggerImport(source: string, mode: 'full' | 'dry_run') {
    setTriggerLoading(`${source}_${mode}`);
    try {
      const { data, error } = await supabase.functions.invoke('start-zoho-import', {
        body: { source_system: source, mode },
      });
      if (error) throw error;
      toast({
        title: mode === 'dry_run' ? 'Testlauf gestartet' : 'Import gestartet',
        description: `${IMPORT_SOURCES.find(s => s.key === source)?.label} – ${mode === 'dry_run' ? 'Dry Run' : 'Vollimport'} wurde ausgelöst.`,
      });
      setTimeout(() => { fetchSourceStats(); fetchLogs(); }, 2000);
    } catch (err: any) {
      toast({
        title: 'Fehler',
        description: err.message || 'Import konnte nicht gestartet werden.',
        variant: 'destructive',
      });
    } finally {
      setTriggerLoading(null);
    }
  }

  const filteredLogs = logs.filter(log => {
    if (statusFilter !== 'all' && log.import_status !== statusFilter) return false;
    if (sourceFilter !== 'all' && log.source_system !== sourceFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        log.order_number?.toLowerCase().includes(s) ||
        log.external_order_id?.toLowerCase().includes(s) ||
        log.external_customer_id?.toLowerCase().includes(s) ||
        log.message?.toLowerCase().includes(s)
      );
    }
    return true;
  }).sort((a, b) => {
    const d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortDir === 'desc' ? -d : d;
  });

  function formatDate(d: string | null) {
    if (!d) return '–';
    return format(new Date(d), 'dd.MM.yyyy HH:mm', { locale: de });
  }

  if (!canRead) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <Card className="max-w-md w-full text-center p-8">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Kein Zugriff</h2>
          <p className="text-muted-foreground">Sie haben keine Berechtigung für die Importverwaltung.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold gold-text">Importverwaltung</h1>
          <p className="text-muted-foreground text-sm mt-1">Zoho Books Verbindungen & Importprotokolle</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchSourceStats(); fetchLogs(); }}>
          <RefreshCw className="w-4 h-4 mr-2" /> Aktualisieren
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="logs">Import-Protokoll</TabsTrigger>
          {canWrite && <TabsTrigger value="actions">Import-Aktionen</TabsTrigger>}
        </TabsList>

        {/* ============ OVERVIEW TAB ============ */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {IMPORT_SOURCES.map(src => {
              const stats = sourceStats[src.key];
              if (loading || !stats) {
                return (
                  <Card key={src.key} className="border-border">
                    <CardHeader className="pb-3">
                      <Skeleton className="h-5 w-40" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                );
              }
              const hasActivity = stats.total > 0;
              return (
                <Card key={src.key} className="border-border hover:border-primary/30 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-primary" />
                        {src.label}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {src.region}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Importierte Datensätze</span>
                      <span className="font-medium">{stats.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-[hsl(var(--success))]" /> Erfolgreich
                      </span>
                      <span className="font-medium text-[hsl(var(--success))]">{stats.success}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-destructive" /> Fehlgeschlagen
                      </span>
                      <span className="font-medium text-destructive">{stats.failed}</span>
                    </div>
                    <div className="border-t border-border pt-3 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Letzter Import</span>
                        <span>{formatDate(stats.lastImport)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Letzter Erfolg</span>
                        <span className="text-[hsl(var(--success))]">{formatDate(stats.lastSuccess)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Letzter Fehler</span>
                        <span className="text-destructive">{formatDate(stats.lastFailed)}</span>
                      </div>
                    </div>
                    {!hasActivity && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                        <Inbox className="w-3 h-3" /> Noch keine Importe
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ============ LOGS TAB ============ */}
        <TabsContent value="logs" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Auftragsnr., ext. ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-secondary border-border"
              />
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[180px] bg-secondary border-border">
                <SelectValue placeholder="Quelle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Quellen</SelectItem>
                {IMPORT_SOURCES.map(s => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] bg-secondary border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="success">Erfolgreich</SelectItem>
                <SelectItem value="pending">Ausstehend</SelectItem>
                <SelectItem value="failed">Fehlgeschlagen</SelectItem>
                <SelectItem value="skipped">Übersprungen</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
              <ArrowUpDown className="w-4 h-4" />
            </Button>
          </div>

          {/* Table */}
          {logsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredLogs.length === 0 ? (
            <Card className="border-border">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold mb-1">Keine Importprotokolle</h3>
                <p className="text-muted-foreground text-sm">Es wurden noch keine Importe durchgeführt oder die Filter ergeben keine Treffer.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Zeitpunkt</TableHead>
                    <TableHead>Quelle</TableHead>
                    <TableHead>Auftragsnr.</TableHead>
                    <TableHead>Ext. Kunden-ID</TableHead>
                    <TableHead>Ext. Auftrags-ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Nachricht</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => (
                    <TableRow key={log.id} className="border-border">
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {log.source_system}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{log.order_number || '–'}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{log.external_customer_id || '–'}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{log.external_order_id || '–'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[log.import_status] || ''}>
                          {log.import_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">
                        {log.message || '–'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ============ ACTIONS TAB ============ */}
        {canWrite && (
          <TabsContent value="actions" className="space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  Import starten
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Importe werden über sichere serverseitige Edge Functions ausgeführt. Keine direkte API-Verbindung vom Browser.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {IMPORT_SOURCES.map(src => (
                    <Card key={src.key} className="border-border bg-secondary/50">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Cloud className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-sm">{src.label}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            disabled={triggerLoading !== null}
                            onClick={() => triggerImport(src.key, 'full')}
                          >
                            {triggerLoading === `${src.key}_full` ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            ) : (
                              <Play className="w-4 h-4 mr-1" />
                            )}
                            Import
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            disabled={triggerLoading !== null}
                            onClick={() => triggerImport(src.key, 'dry_run')}
                          >
                            {triggerLoading === `${src.key}_dry_run` ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            ) : (
                              <Clock className="w-4 h-4 mr-1" />
                            )}
                            Dry Run
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-primary" />
                  Importregeln
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>Zuerst wird der <span className="text-foreground font-medium">Kunde</span> importiert oder aktualisiert</li>
                  <li>Danach wird der <span className="text-foreground font-medium">Auftrag</span> importiert oder aktualisiert</li>
                  <li>Jeder Datensatz erhält das <span className="text-foreground font-medium">source_system</span> der Quelle</li>
                  <li>Original-Auftragsnummern bleiben erhalten</li>
                  <li>Dubletten werden anhand der externen IDs vermieden</li>
                  <li>Importe sind <span className="text-foreground font-medium">idempotent</span> – wiederholte Ausführung erzeugt keine Duplikate</li>
                  <li>Alle Aktionen werden im <span className="text-foreground font-medium">Audit-Log</span> protokolliert</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border bg-secondary/30">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))]" />
                  Edge Functions <span className="font-mono text-foreground">start-zoho-import</span>, <span className="font-mono text-foreground">sync-single-customer</span> und <span className="font-mono text-foreground">sync-single-order</span> müssen serverseitig konfiguriert werden, bevor Importe möglich sind.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
