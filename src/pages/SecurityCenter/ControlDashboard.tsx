import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShieldAlert, RefreshCw, Download, Eye, Check, LockKeyhole, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useSecurityControl, SECURITY_CONTROL_QUERY } from '@/hooks/useSecurityControl';
import { securityTotals, filterSecurityFindings, correctionApproved, type SecurityFinding, type Priority } from '@/lib/securityControl';
import { toast } from 'sonner';

const tone: Record<Priority, string> = { P0: 'text-destructive', P1: 'text-destructive', P2: 'text-warning', P3: 'text-primary', P4: 'text-muted-foreground' };
const fmt = (date: string | null) => date ? new Date(date).toLocaleString('de-DE') : 'Nicht nachgewiesen';
function download(text: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;

export default function SecurityControlDashboard() {
  const { data, error, isLoading, isFetching, refetch } = useSecurityControl();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('all');
  const [priority, setPriority] = useState('all');
  const [status, setStatus] = useState('open');
  const [source, setSource] = useState('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<SecurityFinding | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [wholeComponent, setWholeComponent] = useState(false);
  const totals = useMemo(() => data ? securityTotals(data) : null, [data]);
  const visible = useMemo(() => filterSecurityFindings(data?.findings ?? [], search, area, priority, status)
    .filter(f => source === 'all' || f.source === source), [data, search, area, priority, status, source]);
  const pages = Math.max(1, Math.ceil(visible.length / 50));
  const currentPage = Math.min(page, pages - 1);
  const related = selected ? (data?.findings ?? []).filter(f => f.component === selected.component && f.status === 'open' && !f.potentialFalsePositive) : [];
  const proposal = wholeComponent ? related : selected ? [selected] : [];
  const approval = useMutation({
    mutationFn: async () => {
      const { data: result, error } = await supabase.functions.invoke('security-remediate', { body: {
        action: 'control_approve', report_id: data?.reportId, finding_ids: proposal.map(f => f.id), confirmation,
      } });
      if (error || !result?.ok) throw new Error('Freigabe nicht gespeichert. Bitte Berechtigung und Prüfstand kontrollieren.');
      return result;
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: SECURITY_CONTROL_QUERY }); setSelected(null); setConfirmation(''); toast.success('Korrektur freigegeben; keine Änderung ausgeführt.'); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reset = (setter: (value: string) => void, value: string) => { setter(value); setPage(0); };
  if (isLoading) return <p className="py-8 text-muted-foreground">Sicherheitsbericht wird geladen …</p>;
  if (error || !data || !totals) return <div className="space-y-3 py-8"><ShieldAlert className="text-destructive" /><p>{error?.message ?? 'Kein belegter Prüfstand verfügbar.'}</p><Button variant="outline" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Erneut laden</Button></div>;

  const exportCsv = () => {
    const fields = ['nativeId','source','area','priority','confirmed','status','component','title','cause','impact','recommendation','review','relatedIds'] as const;
    const rows = [fields.join(';'), ...data.findings.map(f => fields.map(key => csvCell(f[key])).join(';'))];
    download('\uFEFF' + rows.join('\r\n'), `ALIXWORK-Sicherheitsinventar-${data.reportId}.csv`, 'text/csv;charset=utf-8');
  };
  const exportReport = () => {
    const header = `# ALIXWORK – Sicherheitsprüfbericht v${data.version}\n\nPrüfstand: ${data.generatedAt}\n\n188 offene Scannerbefunde und 493 Datenbankhinweise getrennt inventarisiert; 25 gezielt behobene Befunde. Kein abschließend deduplizierter Gesamtwert. Tiefenprüfung unvollständig. Bestätigung bezieht sich auf Quellcode, nicht auf produktive Ausnutzung. Weitere Korrekturen benötigen ausdrückliche Freigabe.\n\n## Release Control\n${data.release.reasons.map(r => '- ' + r).join('\n')}\n\nClient proof injection accepted: ${data.release.clientProof}\n\n`;
    const body = data.findings.map(f => `## ${f.nativeId}\n\n${f.priority} – ${f.area} – ${f.status}\n\n**${f.title}**\n\nKomponente: ${f.component}\n\nPrüfstand: ${f.review}\n\nUrsache: ${f.cause}\n\nAuswirkung: ${f.impact}\n\nEmpfehlung: ${f.recommendation}\n\nGeplante Änderung: ${f.plannedChange}\n\nAbhängigkeiten:\n${f.dependencies.map(x => '- '+x).join('\n')}\n\nRegressionstests:\n${f.tests.map(x => '- '+x).join('\n')}\n\nWiederherstellung: ${f.rollback}\n\nVerwandte Befunde: ${f.relatedIds.join(', ') || 'Keine bestätigte Dublette zugeordnet'}\n`).join('\n');
    download(header + body, `ALIXWORK-Sicherheitspruefbericht-${data.reportId}.md`, 'text/markdown;charset=utf-8');
  };
  return <div className="relative z-10 space-y-6 min-w-0 bg-background text-foreground">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Security Control Center v1.0</h2><p className="text-sm text-muted-foreground mt-1">Prüfstand {fmt(data.generatedAt)}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Aktualisieren</Button><Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Inventar</Button><Button variant="outline" size="sm" onClick={exportReport}><Download className="mr-2 h-4 w-4" />Prüfbericht</Button></div>
    </div>
    <section className="border-y border-border py-4 space-y-2">
      <div className="flex items-center gap-2 text-warning font-medium"><ShieldAlert className="h-5 w-5 shrink-0" />Sicherheitsabnahme ausstehend</div>
      <p className="text-sm">{data.sourceCounts.deepOpen} offene Scannerbefunde · {data.sourceCounts.databaseHints} Datenbankhinweise · {data.sourceCounts.fixedSelected} gezielt behoben.</p>
      <p className="text-xs text-muted-foreground">Quellbestände werden nicht ungeprüft addiert. Prioritäten sind vorläufig, soweit keine Einzelprüfung dokumentiert ist. Der bisherige Tiefenscan ist unvollständig; die neu angeforderte Tiefenprüfung ist in diesem Bericht noch nicht enthalten.</p>
    </section>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {[
        ['Gesamte Sicherheitsbefunde', totals.total ?? 'Abgleich offen'], ['Behobene ausgewählte Befunde', totals.resolved],
        ['Offene Scannerbefunde', data.sourceCounts.deepOpen], ['Datenbankhinweise', data.sourceCounts.databaseHints],
        ['P0 · Kritisch', totals.priorities.P0], ['P1 · Hoch', totals.priorities.P1], ['P2 · Mittel', totals.priorities.P2], ['P3 · Niedrig', totals.priorities.P3],
        ['P4 · Informativ / Prüfverdacht', totals.priorities.P4], ['Mögliche Fehlalarme', totals.possibleFalsePositives],
      ].map(([label,value]) => <div key={label} className="border border-border rounded-md p-3 min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold break-words">{value}</p></div>)}
    </div>
    <div className="grid md:grid-cols-2 gap-4 text-sm border-b border-border pb-4">
      <div><p className="text-muted-foreground text-xs">Letzter vollständiger Sicherheitsscan</p><p className="mt-1">{fmt(data.lastCompleteScan)}</p></div>
      <div><p className="text-muted-foreground text-xs">Letzte erfolgreiche begrenzte Sicherheitsprüfung</p><p className="mt-1">{fmt(data.lastSuccessfulCheck)}</p><p className="text-xs text-muted-foreground">Kein Nachweis einer vollständigen Sicherheitsabnahme.</p></div>
    </div>
    <section className="space-y-3 border-b border-border pb-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-destructive" />Product Hub · Pilot und Produktivbetrieb gesperrt</h3><Button variant="outline" size="sm" asChild><Link to="/product-hub/v2?tab=sites">Release Control v1.1</Link></Button></div>
      <ul className="text-sm space-y-1">{data.release.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
      <details className="text-sm"><summary className="cursor-pointer text-primary">Client proof injection accepted</summary><p className="text-muted-foreground mt-2">{data.release.clientProof}</p></details>
      <p className="text-xs text-muted-foreground">{totals.confirmedBlockers.length} bestätigte kritische/hohe Product-Hub-Quellcodebefunde. Eine Korrekturfreigabe ist keine Pilotfreigabe.</p>
    </section>
    <section className="space-y-3">
      <h3 className="font-semibold">Befunde und Prioritäten</h3>
      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-2">
        <Input aria-label="Sicherheitsbefunde suchen" placeholder="Kennung oder Komponente" value={search} onChange={e => reset(setSearch,e.target.value)} />
        <Select value={area} onValueChange={v => reset(setArea,v)}><SelectTrigger aria-label="Funktionsbereich"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Bereiche</SelectItem>{[...new Set(data.findings.map(f => f.area))].sort().map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>
        <Select value={priority} onValueChange={v => reset(setPriority,v)}><SelectTrigger aria-label="Priorität"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Prioritäten</SelectItem>{(['P0','P1','P2','P3','P4'] as const).map(p => <SelectItem value={p} key={p}>{p}</SelectItem>)}</SelectContent></Select>
        <Select value={source} onValueChange={v => reset(setSource,v)}><SelectTrigger aria-label="Prüfquelle"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Prüfquellen</SelectItem><SelectItem value="agent_security_v2">Tiefenscan</SelectItem><SelectItem value="supabase_linter">Datenbankhinweise</SelectItem></SelectContent></Select>
        <Select value={status} onValueChange={v => reset(setStatus,v)}><SelectTrigger aria-label="Befundstatus"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Status</SelectItem><SelectItem value="open">Offen</SelectItem><SelectItem value="resolved">Behoben</SelectItem></SelectContent></Select>
      </div>
      <p className="text-xs text-muted-foreground">{visible.length} Prüfdatensätze · einschließlich getrennter Quellhinweise, kein eindeutiger Schwachstellen-Gesamtwert</p>
      <div className="border border-border rounded-md overflow-x-auto"><Table>
        <TableHeader><TableRow><TableHead>Priorität</TableHead><TableHead>Befund / Komponente</TableHead><TableHead>Bereich</TableHead><TableHead>Prüfstand</TableHead><TableHead className="w-12"><span className="sr-only">Details</span></TableHead></TableRow></TableHeader>
        <TableBody>{visible.slice(currentPage * 50, (currentPage + 1) * 50).map(f => <TableRow key={f.id}>
          <TableCell><Badge variant="outline" className={tone[f.priority]}>{f.priority}</Badge></TableCell>
          <TableCell className="min-w-56 max-w-md whitespace-normal"><p className="text-sm font-medium">{f.title}</p><p className="font-mono text-xs text-muted-foreground mt-1 break-all">{f.component}</p></TableCell>
          <TableCell className="whitespace-normal text-xs">{f.area}</TableCell>
          <TableCell className="text-xs whitespace-normal">{f.status === 'resolved' ? <span className="text-success">Behoben</span> : f.confirmed ? 'Quellcode bestätigt' : f.potentialFalsePositive ? 'Fehlalarm prüfen' : 'Einzelprüfung offen'}{correctionApproved(data.reportId,f.id,data.approvals) && <p className="text-primary mt-1">Korrektur freigegeben</p>}</TableCell>
          <TableCell><Button size="icon" variant="ghost" title="Befund und Korrekturplan öffnen" aria-label={`Details ${f.nativeId}`} onClick={() => { setSelected(f); setWholeComponent(false); setConfirmation(''); }}><Eye className="h-4 w-4" /></Button></TableCell>
        </TableRow>)}{!visible.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Keine passenden Befunde</TableCell></TableRow>}</TableBody>
      </Table></div>
      <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Seite {currentPage+1} von {pages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage-1)}>Zurück</Button><Button variant="outline" size="sm" disabled={currentPage+1 >= pages} onClick={() => setPage(currentPage+1)}>Weiter</Button></div></div>
    </section>
    <section className="border-t border-border pt-4 space-y-3"><h3 className="font-semibold">Regression · zwölf abgesicherte Eingänge</h3>{!data.regression.length ? <p className="text-sm text-muted-foreground">Aktuelle Regressionsergebnisse noch nicht eingetragen.</p> : <div className="grid sm:grid-cols-2 gap-2">{data.regression.map(r => <div key={r.endpoint} className="text-xs border border-border rounded-md p-3"><p className="font-mono break-all">{r.endpoint}</p><p className="text-success mt-1">Unberechtigter Aufruf: {r.unauthorizedStatus}</p><p className="text-muted-foreground mt-1">Berechtigter Weg: {r.authorized}</p></div>)}</div>}</section>
    <Dialog open={!!selected} onOpenChange={open => { if (!open) { setSelected(null); setConfirmation(''); } }}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>{selected?.nativeId}</DialogDescription></DialogHeader>
      {selected && <div className="space-y-4 text-sm min-w-0">
        <Badge variant="outline" className={tone[selected.priority]}>{selected.priority} · {selected.area}</Badge>
        <p className="font-mono text-xs break-all">{selected.component}</p><p className="text-muted-foreground">{selected.review}</p>
        <dl className="space-y-3">{[['Technische Ursache',selected.cause],['Mögliche Auswirkungen',selected.impact],['Empfohlene Korrektur',selected.recommendation],['Geplante Änderungen',selected.plannedChange],['Wiederherstellung',selected.rollback]].map(([label,value]) => <div key={label}><dt className="font-medium">{label}</dt><dd className="text-muted-foreground mt-1 whitespace-pre-wrap break-words">{value}</dd></div>)}</dl>
        <div><h4 className="font-medium">Abhängigkeiten</h4><ul className="list-disc pl-5 text-muted-foreground">{selected.dependencies.map(x => <li key={x}>{x}</li>)}</ul></div>
        <div><h4 className="font-medium">Vorgesehene Regressionstests</h4><ul className="list-disc pl-5 text-muted-foreground">{selected.tests.map(x => <li key={x}>{x}</li>)}</ul></div>
        <p className="text-xs text-muted-foreground">Verwandte Befunde: {selected.relatedIds.join(', ') || 'Keine bestätigte Dublette zugeordnet'}</p>
        {selected.status === 'open' && !selected.potentialFalsePositive && <div className="border-t border-border pt-4 space-y-3">
          {related.length > 1 && related.length <= 25 && <Button variant={wholeComponent ? 'default' : 'outline'} size="sm" onClick={() => setWholeComponent(v => !v)}><Layers className="mr-2 h-4 w-4" />{wholeComponent ? 'Paket gewählt' : 'Zusammengehöriges Paket'} ({related.length})</Button>}
          {wholeComponent && <ul className="text-xs text-muted-foreground">{proposal.map(f => <li key={f.id}>{f.nativeId} · {f.title}</li>)}</ul>}
          <p>Freigabe gilt nur für die oben dokumentierte Korrektur. Keine automatische Ausführung oder Freigabe des Product Hub.</p>
          <Input aria-label="Korrekturfreigabe bestätigen" placeholder="KORREKTUR FREIGEBEN" value={confirmation} onChange={e => setConfirmation(e.target.value)} />
          <Button disabled={confirmation !== 'KORREKTUR FREIGEBEN' || approval.isPending} onClick={() => approval.mutate()}><Check className="mr-2 h-4 w-4" />{approval.isPending ? 'Wird gespeichert …' : 'Korrektur freigeben'}</Button>
        </div>}
      </div>}
    </DialogContent></Dialog>
  </div>;
}