import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertTriangle, PlayCircle, Database, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';

const TARGET_TABLES = [
  'model_manuals',
  'support_videos',
  'customer_notes',
  'maintenance_confirmations',
  'academy_sessions',
  'academy_bookings',
  'email_unsubscribe_tokens',
  'suppressed_emails',
  'alixsmart_migration_map',
  'alixsmart_migration_logs',
] as const;

const LAGER_EXT_COLUMNS = [
  'alixsmart_source_id',
  'source_system',
  'alixsmart_user_id',
  'customer_email',
  'customer_name',
  'device_status',
  'commissioning_date',
  'last_service_date',
  'next_service_date',
  'alixsmart_metadata',
];

type TableStatus = { table: string; exists: boolean; rowCount: number | null; error?: string };
type MapRow = { id: string; source_table: string; source_id: string; target_table: string; target_id: string | null; migration_status: string; conflict_status: string | null; error_message: string | null; created_at: string };
type LogRow = { id: string; migration_batch_id: string | null; source_table: string | null; action: string | null; status: string | null; rows_processed: number; rows_success: number; rows_failed: number; error_message: string | null; created_at: string };

export default function AlixSmartMigration() {
  const [tableStatus, setTableStatus] = useState<TableStatus[]>([]);
  const [lagerCols, setLagerCols] = useState<string[]>([]);
  const [mapRows, setMapRows] = useState<MapRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dryRunOk, setDryRunOk] = useState<boolean | null>(null);
  const [dryRunRunning, setDryRunRunning] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const status: TableStatus[] = [];
      for (const t of TARGET_TABLES) {
        const { count, error } = await supabase.from(t as any).select('*', { count: 'exact', head: true });
        status.push({
          table: t,
          exists: !error,
          rowCount: count ?? null,
          error: error?.message,
        });
      }
      setTableStatus(status);

      // Detect lager_devices extensions via probing a select; if column missing, error
      const { data: lagerSample, error: lagerErr } = await supabase
        .from('lager_devices')
        .select(LAGER_EXT_COLUMNS.join(','))
        .limit(1);
      if (lagerErr) {
        setLagerCols([]);
      } else {
        setLagerCols(LAGER_EXT_COLUMNS); // all queryable
        void lagerSample;
      }

      const { data: mapData } = await supabase
        .from('alixsmart_migration_map')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      setMapRows((mapData as any) || []);

      const { data: logData } = await supabase
        .from('alixsmart_migration_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      setLogs((logData as any) || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const allTablesReady = tableStatus.length > 0 && tableStatus.every(t => t.exists);
  const schemaReady = allTablesReady && lagerCols.length === LAGER_EXT_COLUMNS.length;
  const conflicts = mapRows.filter(r => r.conflict_status || r.migration_status === 'conflict' || r.error_message);

  async function runDryRun() {
    setDryRunRunning(true);
    setDryRunOk(null);
    try {
      // Pure local validation – no edge call yet (no real import in this milestone).
      // The dry-run only verifies schema readiness and policy access.
      const checks: { name: string; ok: boolean; detail?: string }[] = [];
      checks.push({ name: 'Alle Zieltabellen vorhanden', ok: allTablesReady });
      checks.push({ name: 'lager_devices Erweiterungen vorhanden', ok: lagerCols.length === LAGER_EXT_COLUMNS.length });

      // probe insert/select rights on migration_logs
      const { error: probeErr } = await supabase
        .from('alixsmart_migration_logs')
        .insert({
          migration_batch_id: 'dryrun-' + Date.now(),
          source_table: 'dryrun',
          action: 'dry_run',
          status: 'success',
          rows_processed: 0,
          rows_success: 0,
          rows_failed: 0,
          metadata: { note: 'schema readiness probe' },
        });
      checks.push({ name: 'Schreibzugriff auf alixsmart_migration_logs', ok: !probeErr, detail: probeErr?.message });

      const ok = checks.every(c => c.ok);
      setDryRunOk(ok);
      if (ok) toast.success('Dry-Run erfolgreich – Schema ist bereit.');
      else toast.error('Dry-Run hat Probleme gefunden – siehe Logs.');
      await loadAll();
    } catch (e: any) {
      setDryRunOk(false);
      toast.error('Dry-Run fehlgeschlagen: ' + e.message);
    } finally {
      setDryRunRunning(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            AlixSmart Migration
          </h1>
          <p className="text-sm text-muted-foreground">Vorbereitung & Statusübersicht – kein echter Import.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Aktualisieren
          </Button>
          <Button size="sm" onClick={runDryRun} disabled={dryRunRunning || !schemaReady}>
            <PlayCircle className={`w-4 h-4 mr-2 ${dryRunRunning ? 'animate-spin' : ''}`} />Dry-Run starten
          </Button>
          <Button size="sm" variant="default" disabled={!dryRunOk} title={!dryRunOk ? 'Erst Dry-Run erfolgreich abschließen' : 'Import starten'}>
            <Upload className="w-4 h-4 mr-2" />Import starten
          </Button>
        </div>
      </div>

      <Alert variant={schemaReady ? 'default' : 'destructive'}>
        {schemaReady ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        <AlertTitle>Schema vorbereitet: {schemaReady ? 'Ja' : 'Nein'}</AlertTitle>
        <AlertDescription>
          {schemaReady
            ? 'Alle Zieltabellen und Erweiterungen sind vorhanden. Sie können einen Dry-Run starten.'
            : 'Es fehlen noch Tabellen oder Spalten. Migration prüfen.'}
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="tables">
        <TabsList>
          <TabsTrigger value="tables">Tabellenstatus</TabsTrigger>
          <TabsTrigger value="lager">lager_devices Erweiterung</TabsTrigger>
          <TabsTrigger value="mapping">Mapping ({mapRows.length})</TabsTrigger>
          <TabsTrigger value="logs">Import-Logs ({logs.length})</TabsTrigger>
          <TabsTrigger value="conflicts">Konflikte ({conflicts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tables">
          <Card>
            <CardHeader><CardTitle>Zieltabellen</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="p-3">Tabelle</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Zeilen</th>
                    <th className="p-3">Hinweis</th>
                  </tr>
                </thead>
                <tbody>
                  {tableStatus.map(t => (
                    <tr key={t.table} className="border-t border-border">
                      <td className="p-3 font-mono">{t.table}</td>
                      <td className="p-3">
                        {t.exists
                          ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="w-3 h-3 mr-1" />vorhanden</Badge>
                          : <Badge variant="outline" className="bg-red-500/15 text-red-500"><XCircle className="w-3 h-3 mr-1" />fehlt</Badge>}
                      </td>
                      <td className="p-3">{t.rowCount ?? '—'}</td>
                      <td className="p-3 text-muted-foreground text-xs">{t.error || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lager">
          <Card>
            <CardHeader><CardTitle>lager_devices – neue Spalten</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {LAGER_EXT_COLUMNS.map(c => {
                  const ok = lagerCols.includes(c);
                  return (
                    <Badge key={c} variant="outline" className={ok ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'}>
                      {ok ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                      {c}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping">
          <Card>
            <CardHeader><CardTitle>Mapping</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="p-3">Quelle</th>
                    <th className="p-3">Source-ID</th>
                    <th className="p-3">Ziel</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Konflikt</th>
                    <th className="p-3">Zeit</th>
                  </tr>
                </thead>
                <tbody>
                  {mapRows.map(r => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3 font-mono text-xs">{r.source_table}</td>
                      <td className="p-3 font-mono text-xs">{r.source_id}</td>
                      <td className="p-3 font-mono text-xs">{r.target_table}{r.target_id ? ' · ' + r.target_id.slice(0,8) : ''}</td>
                      <td className="p-3"><Badge variant="outline">{r.migration_status}</Badge></td>
                      <td className="p-3 text-xs">{r.conflict_status || '—'}</td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString('de-DE')}</td>
                    </tr>
                  ))}
                  {!mapRows.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Keine Mapping-Einträge</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader><CardTitle>Import-Logs</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="p-3">Zeit</th>
                    <th className="p-3">Batch</th>
                    <th className="p-3">Tabelle</th>
                    <th className="p-3">Aktion</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">P/E/F</th>
                    <th className="p-3">Fehler</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="p-3 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString('de-DE')}</td>
                      <td className="p-3 font-mono text-xs">{l.migration_batch_id || '—'}</td>
                      <td className="p-3 font-mono text-xs">{l.source_table || '—'}</td>
                      <td className="p-3 text-xs">{l.action || '—'}</td>
                      <td className="p-3"><Badge variant="outline">{l.status || '—'}</Badge></td>
                      <td className="p-3 text-xs">{l.rows_processed}/{l.rows_success}/{l.rows_failed}</td>
                      <td className="p-3 text-xs text-red-500">{l.error_message || ''}</td>
                    </tr>
                  ))}
                  {!logs.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Keine Logs</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts">
          <Card>
            <CardHeader><CardTitle>Konflikte</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="p-3">Quelle</th>
                    <th className="p-3">Source-ID</th>
                    <th className="p-3">Konflikt</th>
                    <th className="p-3">Fehler</th>
                  </tr>
                </thead>
                <tbody>
                  {conflicts.map(c => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="p-3 font-mono text-xs">{c.source_table}</td>
                      <td className="p-3 font-mono text-xs">{c.source_id}</td>
                      <td className="p-3 text-xs">{c.conflict_status || c.migration_status}</td>
                      <td className="p-3 text-xs text-red-500">{c.error_message || ''}</td>
                    </tr>
                  ))}
                  {!conflicts.length && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Keine Konflikte</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
