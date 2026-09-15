import { useEffect, useMemo, useState } from 'react';
import { DatabaseBackup, Download, RefreshCw, ShieldCheck, Clock, HardDrive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { logGobdExport } from '@/lib/finance/gobd';

type Backup = {
  id: string; backup_type: string; backup_scope: string | null; backup_status: string;
  started_at: string; completed_at: string | null; backup_size_bytes: number | null;
  storage_location: string | null; storage_path: string | null; file_count: number | null;
  integrity_status: string | null; message: string | null;
};
type Run = {
  id: string; backup_path: string | null; backup_location: string | null; backup_created_at: string | null;
  target_env: string; executor_context: string | null; status: string; started_at: string;
  finished_at: string | null; rpo_seconds: number | null; rto_seconds: number | null;
  tables_restored: number; rows_restored: number;
};
type Check = {
  id: string; run_id: string; category: string; check_name: string; expected: string | null;
  actual: string | null; diff: number | null; status: string; created_at: string;
};
type CheckRow = { bereich: string; pruefung: string; status: string; detail: string };
type Doc = { id: string; version: string; title: string; section: string; content_md: string; valid_from: string };

function variant(s: string): 'outline' | 'destructive' | 'secondary' {
  if (s === 'BESTANDEN') return 'outline';
  if (s === 'FEHLER') return 'destructive';
  return 'secondary';
}
function runVariant(s: string): 'outline' | 'destructive' | 'secondary' {
  if (s === 'passed') return 'outline';
  if (s === 'failed') return 'destructive';
  return 'secondary';
}
const dt = (d?: string | null) => (d ? new Date(d).toLocaleString('de-DE') : '—');
const mb = (b?: number | null) => (b ? `${(b / 1024 / 1024).toFixed(1)} MB` : '—');
const csv = (rows: (string | number | null | undefined)[][]) =>
  rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');

function download(name: string, content: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
}

export default function GobdWiederherstellung() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [report, setReport] = useState<CheckRow[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [runId, setRunId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [b, r, p, d] = await Promise.all([
      (supabase as any).from('backups_metadata').select('*').order('started_at', { ascending: false }).limit(25),
      (supabase as any).from('gobd_restore_runs').select('*').order('started_at', { ascending: false }).limit(25),
      (supabase as any).rpc('gobd_phase15_check'),
      (supabase as any).from('gobd_procedure_docs').select('*').eq('version', '1.2').order('section'),
    ]);
    setBackups(b.data ?? []);
    setRuns(r.data ?? []);
    setReport(p.data ?? []);
    setDocs(d.data ?? []);
    const first = (r.data ?? []).find((x: Run) => x.status !== 'running') ?? (r.data ?? [])[0];
    if (first) {
      setRunId(first.id);
      const c = await (supabase as any).from('gobd_restore_checks').select('*').eq('run_id', first.id).order('category');
      setChecks(c.data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function selectRun(id: string) {
    setRunId(id);
    const c = await (supabase as any).from('gobd_restore_checks').select('*').eq('run_id', id).order('category');
    setChecks(c.data ?? []);
  }

  const lastOk = useMemo(() => backups.find(b => b.backup_status === 'success'), [backups]);
  const lastValid = useMemo(() => backups.find(b => b.integrity_status === 'valid'), [backups]);
  const lastRun = useMemo(() => runs.find(r => r.status !== 'running'), [runs]);
  const fails = report.filter(r => r.status === 'FEHLER').length;
  const warns = report.filter(r => r.status === 'WARNUNG').length;

  async function exportReport() {
    const rows: (string | number | null)[][] = [
      ['GoBD Phase 15 – Datensicherung und Wiederherstellung'],
      ['Erstellt am', new Date().toLocaleString('de-DE')],
      [],
      ['Bereich', 'Prüfung', 'Status', 'Detail'],
      ...report.map(r => [r.bereich, r.pruefung, r.status, r.detail]),
      [],
      ['Einzelprüfungen des Laufs'],
      ['Kategorie', 'Prüfung', 'Erwartet', 'Tatsächlich', 'Differenz', 'Status'],
      ...checks.map(c => [c.category, c.check_name, c.expected, c.actual, c.diff, c.status]),
    ];
    download(`gobd-phase15-${new Date().toISOString().slice(0, 10)}.csv`, csv(rows));
    try {
      await logGobdExport({
        exportType: 'gobd_phase15',
        recordCount: report.length + checks.length,
        fileName: `gobd-phase15-${new Date().toISOString().slice(0, 10)}.csv`,
      });
    } catch { /* optional */ }
    toast.success('Prüfnachweis exportiert');
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="GoBD · Datensicherung & Wiederherstellung"
        subtitle="Backup-Inventar, echter Wiederherstellungstest in isolierter Umgebung, RPO/RTO und Prüfnachweis (Phase 15)"
        icon={DatabaseBackup}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Aktualisieren
            </Button>
            <Button onClick={() => void exportReport()}>
              <Download className="mr-2 h-4 w-4" /> Prüfnachweis
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><HardDrive className="h-4 w-4" /> Letzte Sicherung</CardTitle></CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{dt(lastOk?.completed_at ?? lastOk?.started_at)}</div>
            <div className="text-xs text-muted-foreground">{mb(lastOk?.backup_size_bytes)} · {lastOk?.file_count ?? 0} Dateien</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4" /> Letzte Integritätsprüfung</CardTitle></CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{lastValid?.integrity_status === 'valid' ? 'gültig' : '—'}</div>
            <div className="text-xs text-muted-foreground">{dt(lastValid?.completed_at ?? lastValid?.started_at)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><DatabaseBackup className="h-4 w-4" /> Letzter Restore-Test</CardTitle></CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{lastRun ? dt(lastRun.finished_at) : '—'}</div>
            <div className="text-xs text-muted-foreground">
              {lastRun ? `${lastRun.rows_restored.toLocaleString('de-DE')} Datensätze · ${lastRun.tables_restored} Tabellen` : 'kein Lauf'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4" /> RPO / RTO (gemessen)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {lastRun?.rpo_seconds != null ? `${(lastRun.rpo_seconds / 3600).toFixed(1)} h` : '—'} /{' '}
              {lastRun?.rto_seconds != null ? `${(lastRun.rto_seconds / 60).toFixed(1)} min` : '—'}
            </div>
            <div className="text-xs text-muted-foreground">{fails} Fehler · {warns} Warnungen</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="report">
        <TabsList>
          <TabsTrigger value="report">Prüfergebnis</TabsTrigger>
          <TabsTrigger value="runs">Restore-Historie</TabsTrigger>
          <TabsTrigger value="checks">Einzelprüfungen</TabsTrigger>
          <TabsTrigger value="backups">Backup-Inventar</TabsTrigger>
          <TabsTrigger value="doc">Notfallanweisung</TabsTrigger>
        </TabsList>

        <TabsContent value="report">
          <Card>
            <CardHeader><CardTitle>GoBD Phase 15 – Datensicherung und Wiederherstellung</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Bereich</TableHead><TableHead>Prüfung</TableHead><TableHead>Status</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
                <TableBody>
                  {report.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap font-medium">{r.bereich}</TableCell>
                      <TableCell>{r.pruefung}</TableCell>
                      <TableCell><Badge variant={variant(r.status)}>{r.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.detail}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs">
          <Card>
            <CardHeader><CardTitle>Restore-Historie</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Start</TableHead><TableHead>Ende</TableHead><TableHead>Sicherung</TableHead>
                  <TableHead>Zielumgebung</TableHead><TableHead>Ausführung</TableHead>
                  <TableHead className="text-right">Datensätze</TableHead><TableHead>RPO/RTO</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {runs.map(r => (
                    <TableRow key={r.id} className={r.id === runId ? 'bg-muted/40 cursor-pointer' : 'cursor-pointer'} onClick={() => void selectRun(r.id)}>
                      <TableCell className="whitespace-nowrap">{dt(r.started_at)}</TableCell>
                      <TableCell className="whitespace-nowrap">{dt(r.finished_at)}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-xs">{r.backup_path ?? '—'}</TableCell>
                      <TableCell>{r.target_env}</TableCell>
                      <TableCell>{r.executor_context ?? '—'}</TableCell>
                      <TableCell className="text-right">{r.rows_restored.toLocaleString('de-DE')}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.rpo_seconds != null ? `${(r.rpo_seconds / 3600).toFixed(1)} h` : '—'} / {r.rto_seconds != null ? `${(r.rto_seconds / 60).toFixed(1)} min` : '—'}
                      </TableCell>
                      <TableCell><Badge variant={runVariant(r.status)}>{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checks">
          <Card>
            <CardHeader><CardTitle>Einzelprüfungen des ausgewählten Laufs</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Kategorie</TableHead><TableHead>Prüfung</TableHead><TableHead>Erwartet</TableHead>
                  <TableHead>Tatsächlich</TableHead><TableHead className="text-right">Differenz</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {checks.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap">{c.category}</TableCell>
                      <TableCell>{c.check_name}</TableCell>
                      <TableCell>{c.expected ?? '—'}</TableCell>
                      <TableCell>{c.actual ?? '—'}</TableCell>
                      <TableCell className="text-right">{c.diff ?? '—'}</TableCell>
                      <TableCell><Badge variant={variant(c.status)}>{c.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backups">
          <Card>
            <CardHeader><CardTitle>Backup-Inventar</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Zeitpunkt</TableHead><TableHead>Typ / Umfang</TableHead><TableHead>Speicherort</TableHead>
                  <TableHead className="text-right">Größe</TableHead><TableHead className="text-right">Dateien</TableHead>
                  <TableHead>Integrität</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {backups.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-nowrap">{dt(b.completed_at ?? b.started_at)}</TableCell>
                      <TableCell>{b.backup_type}{b.backup_scope ? ` · ${b.backup_scope}` : ''}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-xs">{b.storage_location ?? '—'}</TableCell>
                      <TableCell className="text-right">{mb(b.backup_size_bytes)}</TableCell>
                      <TableCell className="text-right">{b.file_count ?? '—'}</TableCell>
                      <TableCell><Badge variant={b.integrity_status === 'valid' ? 'outline' : 'secondary'}>{b.integrity_status ?? '—'}</Badge></TableCell>
                      <TableCell><Badge variant={b.backup_status === 'success' ? 'outline' : 'destructive'}>{b.backup_status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="doc">
          <div className="space-y-4">
            {docs.map(d => (
              <Card key={d.id}>
                <CardHeader><CardTitle className="text-base">{d.section} · {d.title}</CardTitle></CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{d.content_md}</pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
