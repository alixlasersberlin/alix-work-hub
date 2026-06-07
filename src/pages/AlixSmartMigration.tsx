import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  CheckCircle2, XCircle, AlertTriangle, PlayCircle, Database, RefreshCw,
  Upload, Wifi, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

const TARGET_TABLES = [
  'model_manuals', 'support_videos', 'customer_notes', 'maintenance_confirmations',
  'academy_sessions', 'academy_bookings', 'email_unsubscribe_tokens', 'suppressed_emails',
  'alixsmart_migration_map', 'alixsmart_migration_logs',
] as const;

const LAGER_EXT_COLUMNS = [
  'alixsmart_source_id', 'source_system', 'alixsmart_user_id', 'customer_email',
  'customer_name', 'device_status', 'commissioning_date', 'last_service_date',
  'next_service_date', 'alixsmart_metadata',
];

const WAVES: { wave: 1 | 2 | 3 | 4; label: string; tables: string[]; optional?: boolean }[] = [
  { wave: 1, label: 'Welle 1 – Stammdaten', tables: ['profiles', 'user_roles', 'products', 'devices'] },
  { wave: 2, label: 'Welle 2 – Service-Inhalte', tables: ['model_manuals', 'support_videos', 'customer_notes', 'maintenance_confirmations'] },
  { wave: 3, label: 'Welle 3 – Academy & Nachrichten', tables: ['academy_sessions', 'academy_bookings', 'internal_messages'] },
  { wave: 4, label: 'Welle 4 – Optional', tables: ['email_unsubscribe_tokens', 'suppressed_emails', 'audit_logs', 'email_send_log'], optional: true },
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

  // Import engine state
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [dryRunOk, setDryRunOk] = useState<boolean | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [ticketAck, setTicketAck] = useState(false);
  const [waveResults, setWaveResults] = useState<Record<number, any>>({});
  const [schemas, setSchemas] = useState<Record<string, any> | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const status: TableStatus[] = [];
      for (const t of TARGET_TABLES) {
        const { count, error } = await supabase.from(t as any).select('*', { count: 'exact', head: true });
        status.push({ table: t, exists: !error, rowCount: count ?? null, error: error?.message });
      }
      setTableStatus(status);

      const { error: lagerErr } = await supabase
        .from('lager_devices').select(LAGER_EXT_COLUMNS.join(',')).limit(1);
      setLagerCols(lagerErr ? [] : LAGER_EXT_COLUMNS);

      const { data: mapData } = await supabase
        .from('alixsmart_migration_map').select('*')
        .order('created_at', { ascending: false }).limit(200);
      setMapRows((mapData as any) || []);

      const { data: logData } = await supabase
        .from('alixsmart_migration_logs').select('*')
        .order('created_at', { ascending: false }).limit(200);
      setLogs((logData as any) || []);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  const allTablesReady = tableStatus.length > 0 && tableStatus.every(t => t.exists);
  const schemaReady = allTablesReady && lagerCols.length === LAGER_EXT_COLUMNS.length;
  const conflicts = useMemo(
    () => mapRows.filter(r => r.conflict_status || r.migration_status === 'conflict' || r.migration_status === 'error' || r.error_message),
    [mapRows],
  );

  async function callEngine(action: string, body: Record<string, any> = {}) {
    const { data, error } = await supabase.functions.invoke('alixsmart-importer', {
      body: { action, ...body },
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async function testConnection() {
    setRunning('test'); setConnectionOk(null);
    try {
      const res = await callEngine('test-connection');
      setConnectionOk(!!res?.ok);
      if (res?.ok) toast.success(`AlixSmart erreichbar (${res.sample_count} Beispielzeilen).`);
      else toast.error('Verbindung fehlgeschlagen: ' + (res?.error || 'unbekannt'));
      await loadAll();
    } catch (e: any) {
      setConnectionOk(false); toast.error('Verbindung fehlgeschlagen: ' + e.message);
    } finally { setRunning(null); }
  }

  async function runDryRun() {
    setRunning('dryrun'); setDryRunOk(null);
    try {
      // Schema-Probe
      const probe = await supabase
        .from('alixsmart_migration_logs').insert({
          migration_batch_id: 'dryrun-' + Date.now(), source_table: 'dryrun',
          action: 'dry_run_probe', status: 'success',
          rows_processed: 0, rows_success: 0, rows_failed: 0,
          metadata: { note: 'schema readiness' },
        });
      if (probe.error) throw probe.error;

      // Dry-Run aller Wellen 1-3 (Welle 4 optional)
      const results: Record<number, any> = {};
      for (const w of [1, 2, 3] as const) {
        results[w] = await callEngine('dry-run-import', { wave: w });
      }
      setWaveResults((prev) => ({ ...prev, ...results }));
      const allOk = Object.values(results).every((r: any) =>
        Object.values(r.results || {}).every((x: any) => !x.error));
      setDryRunOk(allOk);
      if (allOk) toast.success('Dry-Run erfolgreich.');
      else toast.warning('Dry-Run mit Hinweisen – siehe Konflikte/Logs.');
      await loadAll();
    } catch (e: any) {
      setDryRunOk(false); toast.error('Dry-Run fehlgeschlagen: ' + e.message);
    } finally { setRunning(null); }
  }

  async function analyseSchemas() {
    setRunning('schema');
    try {
      const res = await callEngine('discover-schema');
      setSchemas(res?.schemas || {});
      toast.success('Schema-Analyse abgeschlossen.');
      await loadAll();
    } catch (e: any) {
      toast.error('Schema-Analyse fehlgeschlagen: ' + e.message);
    } finally { setRunning(null); }
  }

  async function importWave(wave: 1 | 2 | 3 | 4) {
    setRunning('wave-' + wave);
    try {
      const res = await callEngine('import-wave', { wave });
      setWaveResults((prev) => ({ ...prev, [wave]: res }));
      toast.success(`Welle ${wave} importiert.`);
      await loadAll();
    } catch (e: any) {
      toast.error(`Welle ${wave} fehlgeschlagen: ` + e.message);
    } finally { setRunning(null); }
  }

  const canImport = schemaReady && connectionOk && dryRunOk && ticketAck;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            AlixSmart Migration
          </h1>
          <p className="text-sm text-muted-foreground">Vorbereitung, Dry-Run und kontrollierter Import.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Aktualisieren
          </Button>
          <Button variant="outline" size="sm" onClick={testConnection} disabled={running === 'test'}>
            <Wifi className={`w-4 h-4 mr-2 ${running === 'test' ? 'animate-spin' : ''}`} />Verbindung testen
          </Button>
          <Button size="sm" onClick={runDryRun} disabled={running === 'dryrun' || !schemaReady || !connectionOk}>
            <PlayCircle className={`w-4 h-4 mr-2 ${running === 'dryrun' ? 'animate-spin' : ''}`} />Dry-Run starten
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <StatusBadge label="Schema bereit" ok={schemaReady} />
        <StatusBadge label="AlixSmart Verbindung" ok={connectionOk} />
        <StatusBadge label="Dry-Run OK" ok={dryRunOk} />
      </div>

      <Alert variant={canImport ? 'default' : 'destructive'}>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Sicherheitsbestätigung</AlertTitle>
        <AlertDescription className="flex items-center gap-2 mt-2">
          <Checkbox id="ack" checked={ticketAck} onCheckedChange={(v) => setTicketAck(!!v)} />
          <label htmlFor="ack" className="text-sm cursor-pointer">
            Ich bestätige, dass Tickets nicht importiert werden.
          </label>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="engine">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="engine">Import Engine</TabsTrigger>
          <TabsTrigger value="tables">Tabellenstatus</TabsTrigger>
          <TabsTrigger value="lager">lager_devices</TabsTrigger>
          <TabsTrigger value="mapping">Mapping ({mapRows.length})</TabsTrigger>
          <TabsTrigger value="logs">Logs ({logs.length})</TabsTrigger>
          <TabsTrigger value="conflicts">Konflikte ({conflicts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="engine">
          <div className="grid md:grid-cols-2 gap-4">
            {WAVES.map((w) => {
              const res = waveResults[w.wave];
              const busy = running === 'wave-' + w.wave;
              return (
                <Card key={w.wave}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{w.label}</span>
                      {w.optional && <Badge variant="outline">optional</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {w.tables.map(t => <Badge key={t} variant="secondary" className="font-mono text-xs">{t}</Badge>)}
                    </div>
                    {res && (
                      <div className="text-xs space-y-1">
                        {Object.entries(res.results || {}).map(([t, r]: any) => (
                          <div key={t} className="flex justify-between font-mono">
                            <span>{t}</span>
                            <span className={r.error ? 'text-red-500' : ''}>
                              {r.error ? r.error : `${r.success}/${r.processed} ok, ${r.failed} fehler`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      size="sm" className="w-full"
                      disabled={busy || !canImport}
                      onClick={() => importWave(w.wave)}
                    >
                      <Upload className={`w-4 h-4 mr-2 ${busy ? 'animate-spin' : ''}`} />
                      Welle {w.wave} importieren
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {!canImport && (
            <Alert variant="default" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Import gesperrt</AlertTitle>
              <AlertDescription>
                Voraussetzungen: Schema bereit, Verbindung erfolgreich, Dry-Run erfolgreich, Ticket-Bestätigung.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="tables">
          <Card><CardHeader><CardTitle>Zieltabellen</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr className="text-left">
                  <th className="p-3">Tabelle</th><th className="p-3">Status</th><th className="p-3">Zeilen</th><th className="p-3">Hinweis</th>
                </tr></thead>
                <tbody>
                  {tableStatus.map(t => (
                    <tr key={t.table} className="border-t border-border">
                      <td className="p-3 font-mono">{t.table}</td>
                      <td className="p-3">{t.exists
                        ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="w-3 h-3 mr-1" />vorhanden</Badge>
                        : <Badge variant="outline" className="bg-red-500/15 text-red-500"><XCircle className="w-3 h-3 mr-1" />fehlt</Badge>}</td>
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
          <Card><CardHeader><CardTitle>lager_devices – neue Spalten</CardTitle></CardHeader>
            <CardContent><div className="flex flex-wrap gap-2">
              {LAGER_EXT_COLUMNS.map(c => {
                const ok = lagerCols.includes(c);
                return (
                  <Badge key={c} variant="outline" className={ok ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'}>
                    {ok ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}{c}
                  </Badge>
                );
              })}
            </div></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping">
          <Card><CardHeader><CardTitle>Mapping</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr className="text-left">
                  <th className="p-3">Quelle</th><th className="p-3">Source-ID</th><th className="p-3">Ziel</th>
                  <th className="p-3">Status</th><th className="p-3">Konflikt</th><th className="p-3">Zeit</th>
                </tr></thead>
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
          <Card><CardHeader><CardTitle>Import-Logs</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr className="text-left">
                  <th className="p-3">Zeit</th><th className="p-3">Batch</th><th className="p-3">Tabelle</th>
                  <th className="p-3">Aktion</th><th className="p-3">Status</th><th className="p-3">P/E/F</th><th className="p-3">Fehler</th>
                </tr></thead>
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
          <Card><CardHeader><CardTitle>Konflikte</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr className="text-left">
                  <th className="p-3">Quelle</th><th className="p-3">Source-ID</th>
                  <th className="p-3">Konflikt</th><th className="p-3">Fehler</th>
                </tr></thead>
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

function StatusBadge({ label, ok }: { label: string; ok: boolean | null }) {
  const cls = ok === true ? 'bg-emerald-500/15 text-emerald-500'
    : ok === false ? 'bg-red-500/15 text-red-500'
    : 'bg-muted text-muted-foreground';
  return (
    <Card><CardContent className="p-4 flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Badge variant="outline" className={cls}>
        {ok === true && <><CheckCircle2 className="w-3 h-3 mr-1" />OK</>}
        {ok === false && <><XCircle className="w-3 h-3 mr-1" />Fehler</>}
        {ok === null && 'offen'}
      </Badge>
    </CardContent></Card>
  );
}
