import { useMemo, useState } from 'react';
import { Copy, RefreshCw, ShieldAlert, PlayCircle, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useSecurityLedger } from '@/hooks/useSecurityLedger';
import { KIND_LABELS, STATUS_LABELS, type LedgerKind, type LedgerStatus } from '@/lib/securityLedger';

const fmt = (v?: string | null) => v ? new Date(v).toLocaleString('de-DE') : 'Nicht nachgewiesen';
const short = (v?: string) => v ? v.slice(0, 10) : '—';
const tone = (status: LedgerStatus) => status === 'VERIFIED' || status === 'FALSE_POSITIVE' ? 'text-success border-success/40'
  : status.startsWith('BLOCKED') ? 'text-warning border-warning/40' : status === 'OPEN' ? 'text-destructive border-destructive/40' : 'text-primary border-primary/40';

function Kpi({ label, value, hint, warn }: { label: string; value: string | number; hint?: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? 'border-warning/50 bg-warning/5' : 'border-border bg-card'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export default function SecurityContinuation() {
  const { data, error, isLoading, refetch, isFetching } = useSecurityLedger();
  const [kind, setKind] = useState<'all' | LedgerKind>('all');
  const [status, setStatus] = useState<'all' | 'workable' | LedgerStatus>('workable');
  const [priority, setPriority] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const rows = useMemo(() => (data?.items ?? []).filter(i =>
    (kind === 'all' || i.kind === kind)
    && (status === 'all' || (status === 'workable' ? ['OPEN', 'IN_PROGRESS', 'FIXED', 'TESTED'].includes(i.status) : i.status === status))
    && (priority === 'all' || i.priority === priority)
    && (!search || `${i.id} ${i.title} ${i.component} ${i.location ?? ''}`.toLowerCase().includes(search.toLowerCase()))), [data, kind, status, priority, search]);
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  const current = Math.min(page, pages - 1);

  if (isLoading) return <p className="py-8 text-muted-foreground">Fortsetzungsstand wird geladen …</p>;
  if (error || !data) return <div className="space-y-3 py-8"><ShieldAlert className="text-destructive" /><p>{error?.message ?? 'Kein Fortsetzungsstand verfügbar.'}</p><Button variant="outline" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Erneut laden</Button></div>;

  const { byKind, scanCurrent, releaseBlocked } = data.summary;
  const n = byKind.native, o = byKind.original, d = byKind.db_linter;
  const v = data.versions;
  const blockedChecks = data.checks.filter(c => c.status.startsWith('BLOCKED'));
  const openChecks = data.checks.filter(c => !c.status.startsWith('BLOCKED') && !['VERIFIED', 'FALSE_POSITIVE'].includes(c.status));
  const copy = async () => { await navigator.clipboard.writeText(data.prompt); toast.success('Fortsetzungsprompt kopiert'); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold">Sicherheitsbereinigung fortsetzen</h2>
          <p className="text-sm text-muted-foreground">Ledger {data.version} · Stand {fmt(data.generatedAt)} · Basis-Commit {v.baseCommit?.slice(0, 9)}</p>
        </div>
        <Badge variant="outline" className={releaseBlocked ? 'ml-auto text-destructive border-destructive/40' : 'ml-auto text-success border-success/40'}>
          {releaseBlocked ? <><Lock className="mr-1 h-3 w-3" />Keine Sicherheitsfreigabe</> : 'Freigabefähig'}
        </Badge>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw className="mr-2 h-4 w-4" />Aktualisieren</Button>
      </div>

      {!scanCurrent && (
        <div className="flex gap-2 rounded-lg border border-warning/50 bg-warning/5 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <p>Der letzte Tiefenscan ist <b>{data.scan.status === 'complete' ? 'vollständig' : 'unvollständig'}</b> und prüfte Commit <code>{String(data.scan.sourceCommit).slice(0, 9)}</code> statt <code>{v.baseCommit?.slice(0, 9)}</code>. Scannerzahlen sind veraltet und gelten nicht als Abschlussnachweis.</p>
        </div>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Kennzahlen je Prüfkategorie (nicht addierbar)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
          <Kpi label="Offen kritisch (Scanner)" value={n.openBySeverity.critical} hint="veraltete Scanbasis" warn={!scanCurrent} />
          <Kpi label="Offen hoch (Scanner)" value={n.openBySeverity.high} hint="veraltete Scanbasis" warn={!scanCurrent} />
          <Kpi label="Ursprüngliche offen, ohne Duplikate" value={o.open} hint={`${o.duplicates} identisch mit Scannerbefunden`} />
          <Kpi label="Offene Datenbankhinweise" value={d.open} hint={`${d.openBySeverity.high} hoch · ${d.openBySeverity.medium} mittel · ${d.openBySeverity.low} niedrig`} />
          <Kpi label="Bereitgestellt, Abnahme offen" value={n.deployed + d.deployed} />
          <Kpi label="Verifiziert abgeschlossen" value={n.verified + o.verified + d.verified} />
          <Kpi label="Verifizierte Fehlalarme" value={n.falsePositive + o.falsePositive + d.falsePositive} />
          <Kpi label="Blockierte Prüfungen" value={blockedChecks.length + d.blocked} warn />
          <Kpi label="Bestandene Tests" value={`${v.tests?.server?.passed ?? '?'} / ${v.tests?.app?.passed ?? '?'}`} hint={`Server / App · Commit ${v.tests?.server?.commit ?? '?'}`} />
          <Kpi label="Fehlgeschlagene Tests" value={(v.tests?.server?.failed ?? 0) + (v.tests?.app?.failed ?? 0)} hint={`${v.tests?.server?.skipped ?? 0} externe bewusst nicht ausgeführt`} />
          <Kpi label="Letzter erfolgreicher Tiefenscan" value={v.lastSuccessfulDeepScan ? fmt(v.lastSuccessfulDeepScan) : 'Keiner'} warn={!v.lastSuccessfulDeepScan} />
          <Kpi label="Geprüfte / aktuelle Version" value={`${String(data.scan.sourceCommit).slice(0, 7)} / ${v.baseCommit?.slice(0, 7)}`} warn={!scanCurrent} />
          <Kpi label="Backup" value={v.backup?.lastFull?.slice(0, 8) ?? '—'} hint={v.backup?.status} warn />
          <Kpi label="Restore" value={v.restore?.status === 'BLOCKED_EXTERNAL' ? 'Blockiert' : v.restore?.status ?? '—'} hint={v.restore?.reason} warn />
          <Kpi label="Sicherheitsfreigabe" value={v.release?.status ?? '—'} hint={v.release?.reason} warn />
          <Kpi label="Product Hub" value={v.protected?.productHubEnabled ? 'Aktiv' : 'Gesperrt'} hint={`Notstopp ${v.protected?.emergencyStopped ? 'aktiv' : 'aus'} · DE/COM ${v.protected?.de}/${v.protected?.com}`} />
        </div>
      </section>

      <section className="rounded-lg border border-primary/30 bg-card p-4 space-y-3">
        <div className="flex items-center gap-2"><PlayCircle className="h-5 w-5 text-primary" /><h3 className="font-semibold">Nächstes Arbeitspaket</h3>
          <span className="ml-auto text-xs text-muted-foreground">{data.packageCount} Pakete offen</span></div>
        {data.nextPackage ? (
          <>
            <p className="text-sm"><Badge variant="outline" className="mr-2">{data.nextPackage.priority}</Badge>{KIND_LABELS[data.nextPackage.kind]} · <b>{data.nextPackage.component}</b> · {data.nextPackage.items.length} Befunde</p>
            <ul className="text-xs space-y-1 max-h-40 overflow-auto font-mono">
              {data.nextPackage.items.map(i => <li key={i.id}>{i.id} — {i.title}</li>)}
            </ul>
          </>
        ) : <p className="text-sm text-muted-foreground">Kein technisch bearbeitbares Paket offen.</p>}
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div><p className="text-xs text-muted-foreground mb-1">Letzter erfolgreicher Schritt</p>{data.lastStep ? <p>{data.lastStep.title}<br /><span className="text-xs text-muted-foreground">{data.lastStep.fix} · {short(data.lastStep.lastChecked)}</span></p> : <p className="text-muted-foreground">Nicht nachgewiesen</p>}</div>
          <div><p className="text-xs text-muted-foreground mb-1">Offene Tests</p><ul className="space-y-1">{openChecks.map(c => <li key={c.id}>• {c.title} <span className="text-xs text-muted-foreground">({STATUS_LABELS[c.status]})</span></li>)}</ul></div>
          <div><p className="text-xs text-muted-foreground mb-1">Externe Blockaden</p><ul className="space-y-1">{blockedChecks.map(c => <li key={c.id}>• {c.title}<br /><span className="text-xs text-muted-foreground">{c.blocker}</span></li>)}</ul></div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2"><p className="text-xs text-muted-foreground">Fortsetzungsprompt</p>
            <Button size="sm" variant="outline" className="ml-auto" onClick={copy}><Copy className="mr-2 h-4 w-4" />Kopieren</Button></div>
          <Textarea readOnly value={data.prompt} className="font-mono text-xs h-56" />
          <p className="text-xs text-muted-foreground">Eine automatische Ausführung ist nicht verfügbar: Es gibt keine sicher authentifizierte Schnittstelle dafür. Korrekturen laufen nur kontrolliert über einen neuen Arbeitsauftrag.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Alle Sicherheitsaufgaben</h3>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Suche nach ID, Titel, Funktion …" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="w-64" />
          <Select value={kind} onValueChange={v => { setKind(v as any); setPage(0); }}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Alle Kategorien</SelectItem>{(Object.keys(KIND_LABELS) as LedgerKind[]).map(k => <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={v => { setStatus(v as any); setPage(0); }}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="workable">Noch zu bearbeiten</SelectItem><SelectItem value="all">Alle Status</SelectItem>{(Object.keys(STATUS_LABELS) as LedgerStatus[]).map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent></Select>
          <Select value={priority} onValueChange={v => { setPriority(v); setPage(0); }}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Alle</SelectItem>{['P0', 'P1', 'P2', 'P3', 'P4'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
          <span className="self-center text-xs text-muted-foreground">{rows.length} Einträge</span>
        </div>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Prio</TableHead><TableHead>Befund</TableHead><TableHead>Kategorie / Quelle</TableHead><TableHead>Betroffen</TableHead>
              <TableHead>Status</TableHead><TableHead>Korrektur / Nachweis</TableHead><TableHead>Geprüft / Bereitgestellt</TableHead><TableHead>Blockade / Nächster Schritt</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.slice(current * 50, current * 50 + 50).map(i => (
                <TableRow key={i.id}>
                  <TableCell>{i.priority}</TableCell>
                  <TableCell className="max-w-[260px]"><p className="text-sm">{i.title}</p><p className="text-[11px] font-mono text-muted-foreground break-all">{i.id}</p>{i.duplicateOf && <p className="text-[11px] text-muted-foreground">Duplikat von {i.duplicateOf}</p>}</TableCell>
                  <TableCell className="text-xs">{KIND_LABELS[i.kind]}<br /><span className="text-muted-foreground">{i.source}</span></TableCell>
                  <TableCell className="text-xs max-w-[200px] break-all">{i.location ?? i.component}</TableCell>
                  <TableCell><Badge variant="outline" className={tone(i.status)}>{STATUS_LABELS[i.status]}</Badge></TableCell>
                  <TableCell className="text-xs max-w-[220px]">{i.fix ?? '—'}{i.evidence && <p className="text-muted-foreground">{i.evidence}</p>}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{String(i.checkedVersion ?? '—').slice(0, 12)}<br />{String(i.deployedVersion ?? '—').slice(0, 12)}<br /><span className="text-muted-foreground">{short(i.lastChecked)}</span></TableCell>
                  <TableCell className="text-xs max-w-[240px]">{i.blocker && <p className="text-warning">{i.blocker}</p>}{i.nextStep}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>Zurück</Button>
          <span>Seite {current + 1} / {pages}</span>
          <Button size="sm" variant="outline" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Weiter</Button>
        </div>
      </section>

      <p className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3 w-3" />Ein Befund gilt erst mit Status „Verifiziert“ als abgeschlossen. „Bereitgestellt“ bedeutet: Korrektur aktiv, aber Abnahme noch offen.</p>
    </div>
  );
}
