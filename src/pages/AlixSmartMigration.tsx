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
  const [wave1Analysis, setWave1Analysis] = useState<any | null>(null);


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

  async function analyseWave1() {
    setRunning('wave1');
    try {
      const res = await callEngine('analyze-wave1');
      setWave1Analysis(res);
      toast.success('Welle 1 analysiert (keine Daten verändert).');
      await loadAll();
    } catch (e: any) {
      toast.error('Welle-1-Analyse fehlgeschlagen: ' + e.message);
    } finally { setRunning(null); }
  }

  function exportCsv(filename: string, rows: any[], columns: string[]) {
    if (!rows.length) { toast.info('Keine Daten zum Export.'); return; }
    const esc = (v: any) => {
      const s = v == null ? '' : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [columns.join(';'), ...rows.map(r => columns.map(c => esc(r[c])).join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }


  async function importWave(wave: 1 | 2 | 3 | 4) {
    setRunning('wave-' + wave);
    try {
      toast.info(`Welle ${wave}: erstelle Backup …`);
      const res = await callEngine('import-wave', { wave });
      setWaveResults((prev) => ({ ...prev, [wave]: res }));
      if (res.aborted) {
        toast.error(`Welle ${wave} abgebrochen: ${res.reason || 'unbekannt'}`);
      } else {
        const s = res.summary || {};
        toast.success(`Welle ${wave}: ${s.imported ?? 0} importiert, ${s.skipped ?? 0} übersprungen, ${s.conflicts ?? 0} Konflikte (${s.duration_ms ?? 0} ms)`);
      }
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
          <Button variant="outline" size="sm" onClick={analyseSchemas} disabled={running === 'schema' || !connectionOk}>
            <Database className={`w-4 h-4 mr-2 ${running === 'schema' ? 'animate-spin' : ''}`} />Schema analysieren
          </Button>
          <Button size="sm" onClick={runDryRun} disabled={running === 'dryrun' || !schemaReady || !connectionOk}>
            <PlayCircle className={`w-4 h-4 mr-2 ${running === 'dryrun' ? 'animate-spin' : ''}`} />Dry-Run starten
          </Button>
          <Button variant="outline" size="sm" onClick={analyseWave1} disabled={running === 'wave1' || !connectionOk}>
            <AlertTriangle className={`w-4 h-4 mr-2 ${running === 'wave1' ? 'animate-spin' : ''}`} />Welle 1 analysieren
          </Button>
          <Button size="sm" variant="default" onClick={materializePending} disabled={running === 'materialize' || !connectionOk}>
            <Database className={`w-4 h-4 mr-2 ${running === 'materialize' ? 'animate-spin' : ''}`} />Pending Profile → Kunden
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
          <TabsTrigger value="schema">Schema-Analyse{schemas ? ` (${Object.keys(schemas).length})` : ''}</TabsTrigger>
          <TabsTrigger value="w1-profiles">Profile-Konflikte{wave1Analysis ? ` (${wave1Analysis.profiles?.items?.length ?? 0})` : ''}</TabsTrigger>
          <TabsTrigger value="w1-roles">Rollen-Konflikte{wave1Analysis ? ` (${wave1Analysis.user_roles?.unmapped?.length ?? 0})` : ''}</TabsTrigger>
          <TabsTrigger value="w1-devices">Device-Konflikte{wave1Analysis ? ` (${wave1Analysis.devices?.items?.length ?? 0})` : ''}</TabsTrigger>
          <TabsTrigger value="w1-summary">W1 Zusammenfassung</TabsTrigger>
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
                        {res.backup && (
                          <div className={`rounded border px-2 py-1 mb-1 ${res.backup.ok ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5'}`}>
                            <div className="font-medium">
                              {res.backup.ok ? '✓ Backup erstellt' : '✗ Backup fehlgeschlagen'}
                            </div>
                            {res.backup.ok && (
                              <div className="text-muted-foreground font-mono">
                                {res.backup.total_rows} Zeilen · {(res.backup.size_bytes/1024).toFixed(1)} KB · {res.backup.duration_ms} ms
                              </div>
                            )}
                            {res.backup.error && <div className="text-red-500">{res.backup.error}</div>}
                          </div>
                        )}
                        {res.aborted && (
                          <div className="rounded border border-red-500/40 bg-red-500/5 px-2 py-1 text-red-500">
                            Welle abgebrochen: {res.reason}
                          </div>
                        )}
                        {res.summary && (
                          <div className="grid grid-cols-2 gap-1 font-mono">
                            <span>importiert</span><span className="text-right">{res.summary.imported}</span>
                            <span>übersprungen</span><span className="text-right">{res.summary.skipped}</span>
                            <span>Konflikte</span><span className="text-right">{res.summary.conflicts}</span>
                            <span>Dauer</span><span className="text-right">{res.summary.duration_ms} ms</span>
                            <span>Batch-ID</span><span className="text-right truncate">{res.summary.batch_id}</span>
                          </div>
                        )}
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
                      {busy ? 'Backup + Import …' : `Welle ${w.wave} mit Backup importieren`}
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
        <TabsContent value="schema">
          <Card>
            <CardHeader>
              <CardTitle>Schema-Analyse (Quelle ↔ Ziel)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!schemas && (
                <p className="text-sm text-muted-foreground">
                  Noch nicht ausgeführt. Klicke oben auf „Schema analysieren".
                </p>
              )}
              {schemas && Object.entries(schemas).map(([src, info]: any) => (
                <div key={src} className="border border-border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="font-mono text-sm">
                      {src} <span className="text-muted-foreground">→</span> {info.target_table}
                    </div>
                    {info.fetch_error
                      ? <Badge variant="outline" className="bg-red-500/15 text-red-500"><XCircle className="w-3 h-3 mr-1" />Fetch-Fehler</Badge>
                      : <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="w-3 h-3 mr-1" />{info.sample_rows} Beispiele</Badge>}
                  </div>
                  {info.fetch_error && (
                    <div className="text-xs text-red-500 font-mono break-all">
                      {info.error_details?.kind === 'upstream_missing_column'
                        ? `Quell-Endpoint nutzt fehlende Spalte ${info.error_details.missing_column}. ${info.fetch_error}`
                        : info.fetch_error}
                    </div>
                  )}
                  <div className="grid md:grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground mb-1">Quellspalten ({info.source_columns.length})</div>
                      <div className="flex flex-wrap gap-1">
                        {info.source_columns.map((c: string) => (
                          <Badge key={c} variant="secondary" className={
                            'font-mono text-[10px] ' +
                            (info.matched_columns.includes(c) ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500')
                          }>{c}</Badge>
                        ))}
                        {!info.source_columns.length && <span className="text-muted-foreground">—</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Zielspalten ({info.target_columns.length})</div>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-auto">
                        {info.target_columns.map((c: string) => (
                          <Badge key={c} variant="outline" className="font-mono text-[10px]">{c}</Badge>
                        ))}
                        {!info.target_columns.length && <span className="text-muted-foreground">—</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs grid md:grid-cols-2 gap-2">
                    <div>
                      <span className="text-emerald-500">Matched:</span>{' '}
                      <span className="font-mono">{info.matched_columns.join(', ') || '—'}</span>
                    </div>
                    <div>
                      <span className="text-amber-500">Ignoriert (nicht in Ziel):</span>{' '}
                      <span className="font-mono">{info.skipped_columns.join(', ') || '—'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="w1-profiles">
          <Wave1ProfilesTab data={wave1Analysis?.profiles} onExport={exportCsv} />
        </TabsContent>
        <TabsContent value="w1-roles">
          <Wave1RolesTab data={wave1Analysis?.user_roles} onExport={exportCsv} />
        </TabsContent>
        <TabsContent value="w1-devices">
          <Wave1DevicesTab data={wave1Analysis?.devices} onExport={exportCsv} />
        </TabsContent>
        <TabsContent value="w1-summary">
          <Wave1SummaryTab summary={wave1Analysis?.summary} />
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

function BucketBadges({ buckets }: { buckets: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(buckets).map(([k, v]) => (
        <Badge key={k} variant="outline" className="font-mono text-xs">
          {k}: {v}
        </Badge>
      ))}
    </div>
  );
}

function NotRunHint() {
  return (
    <p className="text-sm text-muted-foreground">
      Noch nicht ausgeführt. Klicke oben auf „Welle 1 analysieren".
    </p>
  );
}

function Wave1ProfilesTab({ data, onExport }: { data: any; onExport: (f: string, r: any[], c: string[]) => void }) {
  if (!data) return <Card><CardContent className="p-6"><NotRunHint /></CardContent></Card>;
  const cols = ['source_id', 'email', 'full_name', 'company', 'zip', 'city', 'match_rule', 'confidence', 'match_class', 'target_id'];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span>Profile – Konfliktanalyse ({data.items.length})</span>
          <Button size="sm" variant="outline" onClick={() => onExport('profiles-konflikte.csv', data.items, cols)}>CSV Export</Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.fetch_error && <div className="text-xs text-red-500">Quell-Fehler: {data.fetch_error}</div>}
        <BucketBadges buckets={data.buckets} />
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 sticky top-0">
              <tr className="text-left">
                {cols.map(c => <th key={c} className="p-2 font-mono">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.items.map((r: any, i: number) => (
                <tr key={i} className="border-t border-border">
                  {cols.map(c => <td key={c} className="p-2 font-mono">{String(r[c] ?? '—')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Wave1RolesTab({ data, onExport }: { data: any; onExport: (f: string, r: any[], c: string[]) => void }) {
  if (!data) return <Card><CardContent className="p-6"><NotRunHint /></CardContent></Card>;
  const mappings: any[] = data.mappings || [];
  const status = data.status_counts || { auto: 0, customer_profile_only: 0, manual: 0, blocked: 0 };
  const aggregates = data.user_aggregates || { customer_profiles: 0, staff: 0, admins: 0 };
  const targetRoles: { name: string; description: string | null }[] = data.target_roles || [];
  const sourceRoles: { name: string; assignment_count: number; user_count: number }[] = data.source_roles || [];
  const statusBadge = (s: string) => {
    if (s === 'auto') return <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">automatisch mappbar</Badge>;
    if (s === 'customer_profile_only') return <Badge className="bg-sky-500/15 text-sky-500 border border-sky-500/30">Kundenprofil ohne Backend-Rolle</Badge>;
    if (s === 'manual') return <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30">manuell prüfen</Badge>;
    return <Badge className="bg-red-500/15 text-red-500 border border-red-500/30">blockiert</Badge>;
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span>Rollen – vollständige Konfliktanalyse</span>
          <Button size="sm" variant="outline" onClick={() => onExport('rollen-mapping.csv', mappings, ['source', 'user_count', 'assignment_count', 'suggested_target', 'status', 'reason'])}>CSV Export</Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        {data.fetch_error && <div className="text-xs text-red-500">Quell-Fehler: {data.fetch_error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="text-2xl font-bold text-emerald-500">{status.auto}</div>
            <div className="text-xs text-muted-foreground">automatisch mappbar</div>
          </div>
          <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3">
            <div className="text-2xl font-bold text-sky-500">{status.customer_profile_only}</div>
            <div className="text-xs text-muted-foreground">Kundenprofil ohne Backend-Rolle</div>
          </div>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="text-2xl font-bold text-amber-500">{status.manual}</div>
            <div className="text-xs text-muted-foreground">manuell prüfen</div>
          </div>
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
            <div className="text-2xl font-bold text-red-500">{status.blocked}</div>
            <div className="text-xs text-muted-foreground">blockiert</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="text-xl font-bold">{aggregates.customer_profiles}</div>
            <div className="text-xs text-muted-foreground">Kundenprofile importierbar</div>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="text-xl font-bold">{aggregates.staff}</div>
            <div className="text-xs text-muted-foreground">Mitarbeiter importierbar</div>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="text-xl font-bold">{aggregates.admins}</div>
            <div className="text-xs text-muted-foreground">Admins importierbar</div>
          </div>
        </div>

        <div>
          <div className="text-muted-foreground mb-2 font-medium">1. Rollen aus AlixSmart ({sourceRoles.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40"><tr className="text-left">
                <th className="p-2">Rolle</th><th className="p-2">Benutzer</th><th className="p-2">Zuweisungen</th>
              </tr></thead>
              <tbody>
                {sourceRoles.map((r) => (
                  <tr key={r.name} className="border-t border-border">
                    <td className="p-2 font-mono">{r.name}</td>
                    <td className="p-2">{r.user_count}</td>
                    <td className="p-2">{r.assignment_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="text-muted-foreground mb-2 font-medium">2. Rollen aus AlixWork ({targetRoles.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40"><tr className="text-left">
                <th className="p-2">Rolle</th><th className="p-2">Beschreibung</th>
              </tr></thead>
              <tbody>
                {targetRoles.map((r) => (
                  <tr key={r.name} className="border-t border-border">
                    <td className="p-2 font-mono">{r.name}</td>
                    <td className="p-2 text-muted-foreground">{r.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="text-muted-foreground mb-2 font-medium">3. Mapping-Vorschlag (keine Änderung – nur Vorschlag)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40"><tr className="text-left">
                <th className="p-2">AlixSmart</th>
                <th className="p-2">Benutzer</th>
                <th className="p-2">Vorschlag AlixWork</th>
                <th className="p-2">Status</th>
                <th className="p-2">Begründung</th>
              </tr></thead>
              <tbody>
                {mappings.map((m, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2 font-mono">{m.source}</td>
                    <td className="p-2">{m.user_count}</td>
                    <td className="p-2 font-mono">{m.suggested_target ?? <span className="text-red-500">— (neue Rolle nötig)</span>}</td>
                    <td className="p-2">{statusBadge(m.status)}</td>
                    <td className="p-2 text-muted-foreground">{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Wave1DevicesTab({ data, onExport }: { data: any; onExport: (f: string, r: any[], c: string[]) => void }) {
  if (!data) return <Card><CardContent className="p-6"><NotRunHint /></CardContent></Card>;
  const cols = ['source_id', 'serial_number', 'model', 'customer_email', 'customer_name', 'match_rule', 'confidence', 'match_class', 'target_id'];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span>Devices – Konfliktanalyse ({data.items.length})</span>
          <Button size="sm" variant="outline" onClick={() => onExport('devices-konflikte.csv', data.items, cols)}>CSV Export</Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.fetch_error && <div className="text-xs text-red-500">Quell-Fehler: {data.fetch_error}</div>}
        <BucketBadges buckets={data.buckets} />
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 sticky top-0">
              <tr className="text-left">
                {cols.map(c => <th key={c} className="p-2 font-mono">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.items.map((r: any, i: number) => (
                <tr key={i} className="border-t border-border">
                  {cols.map(c => <td key={c} className="p-2 font-mono">{String(r[c] ?? '—')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Wave1SummaryTab({ summary }: { summary: any }) {
  if (!summary) return <Card><CardContent className="p-6"><NotRunHint /></CardContent></Card>;
  const rows = [
    { key: 'profiles', ...summary.profiles },
    { key: 'user_roles', ...summary.user_roles },
    { key: 'devices', ...summary.devices },
  ];
  return (
    <Card>
      <CardHeader><CardTitle>Welle 1 – Zusammenfassung</CardTitle></CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40"><tr className="text-left">
            <th className="p-3">Tabelle</th>
            <th className="p-3">Gesamt</th>
            <th className="p-3 text-emerald-500">Importierbar ohne Risiko</th>
            <th className="p-3 text-amber-500">Manuelle Prüfung</th>
            <th className="p-3 text-red-500">Blockiert</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} className="border-t border-border">
                <td className="p-3 font-mono">{r.key}</td>
                <td className="p-3">{r.total}</td>
                <td className="p-3 text-emerald-500">{r.importable_safe}</td>
                <td className="p-3 text-amber-500">{r.manual_review}</td>
                <td className="p-3 text-red-500">{r.blocked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

