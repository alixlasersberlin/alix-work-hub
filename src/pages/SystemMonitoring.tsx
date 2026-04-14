import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Shield, Database, Cloud, AlertTriangle, CheckCircle2, XCircle,
  Clock, RefreshCw, Search, ArrowUpDown, Lock, Inbox, FileText,
  HardDrive, Activity, Eye, UserX, Loader2, Server, ShieldAlert, Key
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d: string | null | undefined) {
  if (!d) return '–';
  return format(new Date(d), 'dd.MM.yyyy HH:mm', { locale: de });
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return '–';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const BACKUP_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  running: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30',
  failed: 'bg-destructive/15 text-destructive border-destructive/30',
  pending: 'bg-muted text-muted-foreground border-border',
};

const IMPORT_STATUS_COLORS: Record<string, string> = {
  success: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  pending: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30',
  failed: 'bg-destructive/15 text-destructive border-destructive/30',
  skipped: 'bg-muted text-muted-foreground border-border',
};

const OTP_STATUS_COLORS: Record<string, string> = {
  verified: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  pending: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30',
  blocked: 'bg-destructive/15 text-destructive border-destructive/30',
  expired: 'bg-muted text-muted-foreground border-border',
};

const IMPORT_SOURCES = [
  { key: 'zoho_eu_1', label: 'Zoho EU 1' },
  { key: 'zoho_eu_2', label: 'Zoho EU 2' },
  { key: 'zoho_us_1', label: 'Zoho USA 1' },
];

export default function SystemMonitoring() {
  const { isAdmin, hasAnyRole } = useAuth();
  const canAccess = isAdmin || hasAnyRole(['Read Only Audit']);

  const [loading, setLoading] = useState(true);

  // KPI data
  const [lastSuccessBackup, setLastSuccessBackup] = useState<string | null>(null);
  const [lastFailedBackup, setLastFailedBackup] = useState<string | null>(null);
  const [lastSuccessImport, setLastSuccessImport] = useState<string | null>(null);
  const [lastFailedImport, setLastFailedImport] = useState<string | null>(null);
  const [securityEventCount, setSecurityEventCount] = useState(0);
  const [blockedOtpCount, setBlockedOtpCount] = useState(0);

  // Backups
  const [backups, setBackups] = useState<any[]>([]);
  const [backupStatusFilter, setBackupStatusFilter] = useState('all');
  const [backupSortDir, setBackupSortDir] = useState<'asc' | 'desc'>('desc');
  const [backupsLoading, setBackupsLoading] = useState(true);

  // Import logs
  const [importLogs, setImportLogs] = useState<any[]>([]);
  const [importSearch, setImportSearch] = useState('');
  const [importStatusFilter, setImportStatusFilter] = useState('all');
  const [importSourceFilter, setImportSourceFilter] = useState('all');
  const [importSortDir, setImportSortDir] = useState<'asc' | 'desc'>('desc');
  const [importsLoading, setImportsLoading] = useState(true);

  // Security
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [otpChallenges, setOtpChallenges] = useState<any[]>([]);
  const [loginSessions, setLoginSessions] = useState<any[]>([]);
  const [securityLoading, setSecurityLoading] = useState(true);

  useEffect(() => {
    if (canAccess) {
      loadAll();
    }
  }, [canAccess]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadKPIs(), loadBackups(), loadImportLogs(), loadSecurity()]);
    setLoading(false);
  }

  async function loadKPIs() {
    const [successBackup, failedBackup, successImport, failedImport, secEvents, blockedOtp] = await Promise.all([
      supabase.from('backups_metadata').select('completed_at').eq('backup_status', 'completed').order('completed_at', { ascending: false }).limit(1),
      supabase.from('backups_metadata').select('started_at').eq('backup_status', 'failed').order('started_at', { ascending: false }).limit(1),
      supabase.from('order_import_logs').select('created_at').eq('import_status', 'success').order('created_at', { ascending: false }).limit(1),
      supabase.from('order_import_logs').select('created_at').eq('import_status', 'failed').order('created_at', { ascending: false }).limit(1),
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }).in('action', ['login_failed', 'unauthorized_access', 'role_change', 'account_blocked', 'password_reset']),
      supabase.from('otp_challenges').select('id', { count: 'exact', head: true }).eq('challenge_status', 'blocked'),
    ]);

    setLastSuccessBackup(successBackup.data?.[0]?.completed_at ?? null);
    setLastFailedBackup(failedBackup.data?.[0]?.started_at ?? null);
    setLastSuccessImport(successImport.data?.[0]?.created_at ?? null);
    setLastFailedImport(failedImport.data?.[0]?.created_at ?? null);
    setSecurityEventCount(secEvents.count ?? 0);
    setBlockedOtpCount(blockedOtp.count ?? 0);
  }

  async function loadBackups() {
    setBackupsLoading(true);
    const { data } = await supabase
      .from('backups_metadata')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(100);
    setBackups(data || []);
    setBackupsLoading(false);
  }

  async function loadImportLogs() {
    setImportsLoading(true);
    const { data } = await supabase
      .from('order_import_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setImportLogs(data || []);
    setImportsLoading(false);
  }

  async function loadSecurity() {
    setSecurityLoading(true);
    const [auditRes, otpRes, sessionRes] = await Promise.all([
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('otp_challenges').select('*').in('challenge_status', ['blocked', 'expired', 'pending']).order('created_at', { ascending: false }).limit(50),
      supabase.from('login_sessions').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(50),
    ]);
    setAuditLogs(auditRes.data || []);
    setOtpChallenges(otpRes.data || []);
    setLoginSessions(sessionRes.data || []);
    setSecurityLoading(false);
  }

  // Filtered data
  const filteredBackups = backups
    .filter(b => backupStatusFilter === 'all' || b.backup_status === backupStatusFilter)
    .sort((a, b) => {
      const d = new Date(a.started_at || a.created_at).getTime() - new Date(b.started_at || b.created_at).getTime();
      return backupSortDir === 'desc' ? -d : d;
    });

  const filteredImports = importLogs
    .filter(l => {
      if (importStatusFilter !== 'all' && l.import_status !== importStatusFilter) return false;
      if (importSourceFilter !== 'all' && l.source_system !== importSourceFilter) return false;
      if (importSearch) {
        const s = importSearch.toLowerCase();
        return l.order_number?.toLowerCase().includes(s) ||
          l.external_order_id?.toLowerCase().includes(s) ||
          l.external_customer_id?.toLowerCase().includes(s) ||
          l.message?.toLowerCase().includes(s);
      }
      return true;
    })
    .sort((a, b) => {
      const d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return importSortDir === 'desc' ? -d : d;
    });

  const reauthSessions = loginSessions.filter(s => s.reauth_required);

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <Card className="max-w-md w-full text-center p-8">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Kein Zugriff</h2>
          <p className="text-muted-foreground">Sie haben keine Berechtigung für den Systembereich.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold gold-text">System & Monitoring</h1>
          <p className="text-muted-foreground text-sm mt-1">Backups, Importe, Sicherheit & Systemstatus</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Aktualisieren
        </Button>
      </div>

      <Tabs defaultValue="status" className="space-y-6">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="status">Systemstatus</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
          <TabsTrigger value="imports">Import-Monitoring</TabsTrigger>
          <TabsTrigger value="security">Sicherheit</TabsTrigger>
        </TabsList>

        {/* ============ STATUS TAB ============ */}
        <TabsContent value="status" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* KPI Cards */}
            <KPICard
              icon={<CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))]" />}
              title="Letzter erfolgreicher Backup"
              value={formatDate(lastSuccessBackup)}
              loading={loading}
              variant="success"
            />
            <KPICard
              icon={<XCircle className="w-5 h-5 text-destructive" />}
              title="Letzter fehlgeschl. Backup"
              value={formatDate(lastFailedBackup)}
              loading={loading}
              variant={lastFailedBackup ? 'danger' : 'neutral'}
            />
            <KPICard
              icon={<Cloud className="w-5 h-5 text-[hsl(var(--success))]" />}
              title="Letzter erfolgreicher Import"
              value={formatDate(lastSuccessImport)}
              loading={loading}
              variant="success"
            />
            <KPICard
              icon={<AlertTriangle className="w-5 h-5 text-destructive" />}
              title="Letzter fehlgeschl. Import"
              value={formatDate(lastFailedImport)}
              loading={loading}
              variant={lastFailedImport ? 'danger' : 'neutral'}
            />
            <KPICard
              icon={<ShieldAlert className="w-5 h-5 text-[hsl(var(--warning))]" />}
              title="Sicherheitsereignisse"
              value={securityEventCount.toString()}
              loading={loading}
              variant={securityEventCount > 0 ? 'warning' : 'neutral'}
            />
            <KPICard
              icon={<Lock className="w-5 h-5 text-destructive" />}
              title="Blockierte OTP-Challenges"
              value={blockedOtpCount.toString()}
              loading={loading}
              variant={blockedOtpCount > 0 ? 'danger' : 'neutral'}
            />
          </div>

          {/* Quick overview cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-primary" /> Backups gesamt
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-16" /> : (
                  <div className="text-3xl font-bold text-primary">{backups.length}</div>
                )}
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Aktive Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-16" /> : (
                  <div className="text-3xl font-bold text-primary">{loginSessions.length}</div>
                )}
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Key className="w-4 h-4 text-[hsl(var(--warning))]" /> Reauth erforderlich
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-16" /> : (
                  <div className={`text-3xl font-bold ${reauthSessions.length > 0 ? 'text-[hsl(var(--warning))]' : 'text-primary'}`}>
                    {reauthSessions.length}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============ BACKUPS TAB ============ */}
        <TabsContent value="backups" className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={backupStatusFilter} onValueChange={setBackupStatusFilter}>
              <SelectTrigger className="w-[180px] bg-secondary border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="completed">Abgeschlossen</SelectItem>
                <SelectItem value="running">Laufend</SelectItem>
                <SelectItem value="failed">Fehlgeschlagen</SelectItem>
                <SelectItem value="pending">Ausstehend</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setBackupSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
              <ArrowUpDown className="w-4 h-4" />
            </Button>
          </div>

          {backupsLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredBackups.length === 0 ? (
            <Card className="border-border">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <HardDrive className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold mb-1">Keine Backups</h3>
                <p className="text-muted-foreground text-sm">Es sind keine Backup-Einträge vorhanden.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Gestartet</TableHead>
                    <TableHead>Abgeschlossen</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Größe</TableHead>
                    <TableHead>Integrität</TableHead>
                    <TableHead>Speicherort</TableHead>
                    <TableHead>Nachricht</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBackups.map(b => (
                    <TableRow key={b.id} className={`border-border ${b.backup_status === 'failed' ? 'bg-destructive/5' : ''}`}>
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(b.started_at)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(b.completed_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">{b.backup_type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{b.backup_scope}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={BACKUP_STATUS_COLORS[b.backup_status] || ''}>
                          {b.backup_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{formatBytes(b.backup_size_bytes)}</TableCell>
                      <TableCell>
                        {b.integrity_status ? (
                          <Badge variant="outline" className={b.integrity_status === 'valid' ? BACKUP_STATUS_COLORS.completed : BACKUP_STATUS_COLORS.failed}>
                            {b.integrity_status}
                          </Badge>
                        ) : '–'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{b.storage_location || '–'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{b.message || '–'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ============ IMPORTS TAB ============ */}
        <TabsContent value="imports" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Auftragsnr., ext. ID…"
                value={importSearch}
                onChange={e => setImportSearch(e.target.value)}
                className="pl-9 bg-secondary border-border"
              />
            </div>
            <Select value={importSourceFilter} onValueChange={setImportSourceFilter}>
              <SelectTrigger className="w-[160px] bg-secondary border-border">
                <SelectValue placeholder="Quelle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Quellen</SelectItem>
                {IMPORT_SOURCES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={importStatusFilter} onValueChange={setImportStatusFilter}>
              <SelectTrigger className="w-[160px] bg-secondary border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="success">Erfolgreich</SelectItem>
                <SelectItem value="pending">Ausstehend</SelectItem>
                <SelectItem value="failed">Fehlgeschlagen</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setImportSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
              <ArrowUpDown className="w-4 h-4" />
            </Button>
          </div>

          {importsLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredImports.length === 0 ? (
            <Card className="border-border">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold mb-1">Keine Importprotokolle</h3>
                <p className="text-muted-foreground text-sm">Keine Treffer für die aktuelle Filterung.</p>
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
                  {filteredImports.map(log => (
                    <TableRow key={log.id} className={`border-border ${log.import_status === 'failed' ? 'bg-destructive/5' : ''}`}>
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs font-mono">{log.source_system}</Badge></TableCell>
                      <TableCell className="font-medium">{log.order_number || '–'}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{log.external_customer_id || '–'}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{log.external_order_id || '–'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={IMPORT_STATUS_COLORS[log.import_status] || ''}>{log.import_status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">{log.message || '–'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ============ SECURITY TAB ============ */}
        <TabsContent value="security" className="space-y-6">
          {securityLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
            </div>
          ) : (
            <>
              {/* Audit Logs */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Letzte Audit-Einträge
                  </CardTitle>
                  <CardDescription>Die neuesten sicherheitsrelevanten Aktionen im System.</CardDescription>
                </CardHeader>
                <CardContent>
                  {auditLogs.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <Inbox className="w-10 h-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">Keine Audit-Einträge vorhanden.</p>
                    </div>
                  ) : (
                    <div className="max-h-[350px] overflow-y-auto rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-xs">Zeitpunkt</TableHead>
                            <TableHead className="text-xs">Aktion</TableHead>
                            <TableHead className="text-xs">Modul</TableHead>
                            <TableHead className="text-xs">Benutzer-ID</TableHead>
                            <TableHead className="text-xs">IP</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditLogs.map(log => (
                            <TableRow key={log.id} className="border-border">
                              <TableCell className="text-xs whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs font-mono">{log.action}</Badge>
                              </TableCell>
                              <TableCell className="text-xs">{log.module}</TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[120px]">{log.user_id ? log.user_id.substring(0, 8) + '…' : '–'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{log.ip_address || '–'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* OTP Challenges */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="w-5 h-5 text-[hsl(var(--warning))]" />
                    OTP-Challenges (blockiert / abgelaufen / offen)
                  </CardTitle>
                  <CardDescription>Zwei-Faktor-Authentifizierungsereignisse mit auffälligem Status.</CardDescription>
                </CardHeader>
                <CardContent>
                  {otpChallenges.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <CheckCircle2 className="w-10 h-10 text-[hsl(var(--success))]/40 mb-3" />
                      <p className="text-sm text-muted-foreground">Keine auffälligen OTP-Challenges.</p>
                    </div>
                  ) : (
                    <div className="max-h-[300px] overflow-y-auto rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-xs">Zeitpunkt</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Kanal</TableHead>
                            <TableHead className="text-xs">Grund</TableHead>
                            <TableHead className="text-xs">Versuche</TableHead>
                            <TableHead className="text-xs">Benutzer-ID</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {otpChallenges.map(otp => (
                            <TableRow key={otp.id} className={`border-border ${otp.challenge_status === 'blocked' ? 'bg-destructive/5' : ''}`}>
                              <TableCell className="text-xs whitespace-nowrap">{formatDate(otp.created_at)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={OTP_STATUS_COLORS[otp.challenge_status] || ''}>
                                  {otp.challenge_status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">{otp.channel}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{otp.challenge_reason || '–'}</TableCell>
                              <TableCell className="text-xs font-mono">
                                <span className={otp.attempt_count >= otp.max_attempts ? 'text-destructive font-semibold' : ''}>
                                  {otp.attempt_count}/{otp.max_attempts}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[120px]">{otp.user_id?.substring(0, 8)}…</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Active Sessions */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Aktive Sessions
                  </CardTitle>
                  <CardDescription>
                    Derzeit aktive Sitzungen.
                    {reauthSessions.length > 0 && (
                      <span className="text-[hsl(var(--warning))] ml-2 font-medium">
                        {reauthSessions.length} erfordern Re-Authentifizierung
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loginSessions.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <Inbox className="w-10 h-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">Keine aktiven Sessions.</p>
                    </div>
                  ) : (
                    <div className="max-h-[300px] overflow-y-auto rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-xs">Erstellt</TableHead>
                            <TableHead className="text-xs">Benutzer-ID</TableHead>
                            <TableHead className="text-xs">IP</TableHead>
                            <TableHead className="text-xs">Gerät</TableHead>
                            <TableHead className="text-xs">OTP verifiziert</TableHead>
                            <TableHead className="text-xs">Reauth</TableHead>
                            <TableHead className="text-xs">Ablauf</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loginSessions.map(s => (
                            <TableRow key={s.id} className={`border-border ${s.reauth_required ? 'bg-[hsl(var(--warning))]/5' : ''}`}>
                              <TableCell className="text-xs whitespace-nowrap">{formatDate(s.created_at)}</TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[120px]">{s.user_id?.substring(0, 8)}…</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{s.ip_address || '–'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{s.device_info || '–'}</TableCell>
                              <TableCell className="text-xs">{formatDate(s.otp_verified_at)}</TableCell>
                              <TableCell>
                                {s.reauth_required ? (
                                  <Badge variant="outline" className="text-xs bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30">Ja</Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Nein</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{formatDate(s.expires_at)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPICard({ icon, title, value, loading, variant }: {
  icon: React.ReactNode;
  title: string;
  value: string;
  loading: boolean;
  variant: 'success' | 'danger' | 'warning' | 'neutral';
}) {
  const borderClass = {
    success: 'border-[hsl(var(--success))]/20',
    danger: 'border-destructive/20',
    warning: 'border-[hsl(var(--warning))]/20',
    neutral: 'border-border',
  }[variant];

  return (
    <Card className={`${borderClass} hover:border-primary/30 transition-colors`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-5 w-24 mt-1" />
            ) : (
              <p className="text-sm font-semibold mt-0.5">{value}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
