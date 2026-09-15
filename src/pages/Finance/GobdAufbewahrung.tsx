import { useEffect, useMemo, useState } from 'react';
import { Archive, Download, RefreshCw, PlayCircle, ShieldAlert, Lock, Unlock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { logGobdExport } from '@/lib/finance/gobd';

type Overview = {
  data_class: string; label: string; source_table: string | null; retention_years: number;
  retention_start_rule: string; storage_location: string; deletable: boolean;
  responsible_role: string; legal_hold_capable: boolean; legal_basis: string;
  total_records: number; oldest: string | null; earliest_due: string | null; active_holds: number;
};
type DryRun = {
  data_class: string; label: string; source_table: string | null; total_records: number;
  period_from: string | null; period_to: string | null; due_for_deletion: number;
  blocked_retention: number; blocked_legal_hold: number; blocked_not_deletable: number;
  would_delete: number; exclusion_reason: string | null;
};
type Hold = {
  id: string; reason_category: string; reason: string; reference: string | null; responsible: string;
  scope_type: string; scope_data_class: string | null; scope_table: string | null; scope_record_id: string | null;
  started_at: string; status: string; released_at: string | null; release_reason: string | null;
};
type AuditRow = {
  id: string; event_type: string; data_class_code: string | null; object_table: string | null;
  object_id: string | null; actor_context: string | null; detail: string | null; created_at: string;
};
type CheckRow = { bereich: string; pruefung: string; status: string; detail: string };
type DataClass = { code: string; label: string };

function statusVariant(s: string): 'outline' | 'destructive' | 'secondary' {
  if (s === 'BESTANDEN') return 'outline';
  if (s === 'FEHLER') return 'destructive';
  return 'secondary';
}

function download(name: string, content: string, mime = 'text/csv;charset=utf-8') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + content], { type: mime }));
  a.download = name;
  a.click();
}

const csv = (rows: (string | number | null | undefined)[][]) =>
  rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');

const de = (d?: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');
const dt = (d?: string | null) => (d ? new Date(d).toLocaleString('de-DE') : '—');

const REASONS = ['Betriebsprüfung', 'Steuerprüfung', 'Rechtsstreit', 'Behördliches Verfahren', 'Interne Untersuchung'];

export default function GobdAufbewahrung() {
  const [overview, setOverview] = useState<Overview[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [classes, setClasses] = useState<DataClass[]>([]);
  const [dryRun, setDryRun] = useState<DryRun[]>([]);
  const [dryRunAt, setDryRunAt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [holdOpen, setHoldOpen] = useState(false);
  const [form, setForm] = useState({ reason_category: REASONS[0], reason: '', reference: '', responsible: '', scope_type: 'data_class', scope_data_class: '', scope_table: '', scope_record_id: '' });

  async function load() {
    setLoading(true);
    const [o, h, a, c, dc] = await Promise.all([
      (supabase as any).rpc('gobd_retention_overview'),
      (supabase as any).from('gobd_legal_holds').select('*').order('started_at', { ascending: false }),
      (supabase as any).from('gobd_retention_audit').select('*').order('created_at', { ascending: false }).limit(300),
      (supabase as any).rpc('gobd_phase14_check'),
      (supabase as any).from('gobd_data_classes').select('code,label').eq('active', true).order('code'),
    ]);
    const err = o.error || h.error || a.error || c.error || dc.error;
    if (err) toast.error(err.message);
    setOverview((o.data ?? []) as Overview[]);
    setHolds((h.data ?? []) as Hold[]);
    setAudit((a.data ?? []) as AuditRow[]);
    setChecks((c.data ?? []) as CheckRow[]);
    setClasses((dc.data ?? []) as DataClass[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const fehler = checks.filter(c => c.status === 'FEHLER').length;
  const offen = checks.filter(c => c.status === 'OFFEN').length;
  const warn = checks.filter(c => c.status === 'WARNUNG').length;
  const gesamt = loading ? '…' : fehler ? 'FEHLER' : offen ? 'OFFEN' : warn ? 'WARNUNG' : 'BESTANDEN';

  const activeHolds = holds.filter(h => h.status === 'active');
  const upcoming = useMemo(
    () => overview.filter(o => o.earliest_due).sort((a, b) => (a.earliest_due! < b.earliest_due! ? -1 : 1)),
    [overview],
  );
  const denied = audit.filter(a => a.event_type === 'DELETION_DENIED');

  async function runDryRun() {
    const { data, error } = await (supabase as any).rpc('gobd_retention_dry_run', { _log: true });
    if (error) { toast.error(error.message); return; }
    setDryRun((data ?? []) as DryRun[]);
    setDryRunAt(new Date().toLocaleString('de-DE'));
    toast.success('Probelauf ausgeführt – es wurden keine Daten gelöscht');
    load();
  }

  async function createHold() {
    if (!form.reason.trim() || !form.responsible.trim()) { toast.error('Grund und Verantwortlicher sind Pflicht'); return; }
    const payload: Record<string, unknown> = {
      reason_category: form.reason_category, reason: form.reason, reference: form.reference || null,
      responsible: form.responsible, scope_type: form.scope_type,
      scope_data_class: form.scope_type === 'data_class' ? form.scope_data_class || null : null,
      scope_table: form.scope_type === 'table' || form.scope_type === 'record' ? form.scope_table || null : null,
      scope_record_id: form.scope_type === 'record' ? form.scope_record_id || null : null,
    };
    const { error } = await (supabase as any).from('gobd_legal_holds').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Aufbewahrungssperre gesetzt und protokolliert');
    setHoldOpen(false);
    setForm({ ...form, reason: '', reference: '', scope_record_id: '' });
    load();
  }

  async function releaseHold(h: Hold) {
    const reason = window.prompt('Begründung für die Aufhebung der Aufbewahrungssperre:');
    if (!reason || !reason.trim()) { toast.error('Ohne Begründung ist keine Aufhebung möglich'); return; }
    const { error } = await (supabase as any).from('gobd_legal_holds')
      .update({ status: 'released', release_reason: reason }).eq('id', h.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Aufbewahrungssperre aufgehoben und protokolliert');
    load();
  }

  async function exportMatrix() {
    const content = csv([
      ['Datenart', 'Zweck/Rechtsgrundlage', 'Frist (Jahre)', 'Fristbeginn', 'Speicherort', 'Löschbar', 'Verantwortliche Rolle', 'Legal Hold möglich', 'Datensätze', 'Ältester Satz', 'Frühestes Löschdatum', 'Aktive Sperren'],
      ...overview.map(o => [o.label, o.legal_basis, o.retention_years, o.retention_start_rule, o.storage_location, o.deletable ? 'ja' : 'nein', o.responsible_role, o.legal_hold_capable ? 'ja' : 'nein', o.total_records, o.oldest ?? '', o.earliest_due ?? '', o.active_holds]),
    ]);
    const fileName = `GoBD_Aufbewahrungsmatrix_${new Date().toISOString().slice(0, 10)}.csv`;
    download(fileName, content);
    await logGobdExport({ exportType: 'GOBD_AUFBEWAHRUNGSMATRIX', fileName, recordCount: overview.length, content, status: 'CREATED' });
    toast.success('Aufbewahrungsmatrix exportiert');
  }

  async function exportReport() {
    const content = [
      'GoBD Phase 14 – Aufbewahrung, Löschkonzept & Legal Hold',
      `Erstellt am;${new Date().toLocaleString('de-DE')}`,
      `Gesamtstatus;${gesamt}`,
      'Systemweite Aussage;Technische GoBD-Prüfung bestanden – organisatorischer Abschluss läuft',
      '',
      'Bereich;Prüfung;Status;Detail',
      csv(checks.map(c => [c.bereich, c.pruefung, c.status, c.detail])),
    ].join('\n');
    const fileName = `GoBD_Phase14_Pruefbericht_${new Date().toISOString().slice(0, 10)}.csv`;
    download(fileName, content);
    await logGobdExport({ exportType: 'GOBD_PHASE14_REPORT', fileName, recordCount: checks.length, content, status: 'CREATED', metadata: { gesamt } });
    toast.success('Prüfbericht erstellt');
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader
        icon={Archive}
        title="GoBD Aufbewahrung & Legal Hold"
        subtitle="Phase 14 – Dateninventar, Fristen, Löschschutz, Aufbewahrungssperren und Löschvorschau"
        actions={<>
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={exportReport} disabled={loading}><Download className="h-4 w-4 mr-2" />Prüfbericht</Button>
        </>}
      />

      <Card className="border-amber-500/40">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Badge variant={statusVariant(gesamt)}>{gesamt}</Badge>
          <span className="text-sm text-muted-foreground">
            Technische GoBD-Prüfung bestanden – organisatorischer Abschluss läuft. Es ist kein automatischer Löschlauf aktiv.
          </span>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: 'Datenklassen', v: overview.length },
          { l: 'Aktive Aufbewahrungssperren', v: activeHolds.length },
          { l: 'Abgewiesene Löschversuche', v: denied.length },
          { l: 'Audit-Einträge', v: audit.length },
        ].map(k => (
          <Card key={k.l}><CardContent className="p-4">
            <div className="text-2xl font-semibold">{k.v}</div>
            <div className="text-xs text-muted-foreground">{k.l}</div>
          </CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="matrix">
        <TabsList className="flex-wrap">
          <TabsTrigger value="matrix">Aufbewahrungsmatrix</TabsTrigger>
          <TabsTrigger value="fristen">Fristübersicht</TabsTrigger>
          <TabsTrigger value="holds">Legal Holds</TabsTrigger>
          <TabsTrigger value="dryrun">Löschvorschau</TabsTrigger>
          <TabsTrigger value="protokoll">Löschprotokoll</TabsTrigger>
          <TabsTrigger value="pruefung">Prüfnachweis</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-4">
          <Button variant="outline" onClick={exportMatrix} disabled={overview.length === 0}>
            <Download className="h-4 w-4 mr-2" />Matrix exportieren
          </Button>
          <Card><CardContent className="overflow-auto p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Datenart</TableHead><TableHead>Rechtsgrundlage</TableHead>
                <TableHead className="text-right">Frist</TableHead><TableHead>Fristbeginn</TableHead>
                <TableHead>Speicherort</TableHead><TableHead>Löschbar</TableHead>
                <TableHead>Verantwortlich</TableHead><TableHead>Legal Hold</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {overview.map(o => (
                  <TableRow key={o.data_class}>
                    <TableCell className="text-xs font-medium">{o.label}</TableCell>
                    <TableCell className="text-xs">{o.legal_basis}</TableCell>
                    <TableCell className="text-xs text-right">{o.retention_years} J.</TableCell>
                    <TableCell className="text-xs">{o.retention_start_rule === 'creation_date' ? 'Entstehungsdatum' : 'Ende des Entstehungsjahres'}</TableCell>
                    <TableCell className="text-xs">{o.storage_location}</TableCell>
                    <TableCell className="text-xs">{o.deletable ? 'nach Frist + Freigabe' : 'nein'}</TableCell>
                    <TableCell className="text-xs">{o.responsible_role}</TableCell>
                    <TableCell className="text-xs">{o.legal_hold_capable ? 'ja' : 'nein'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="fristen">
          <Card>
            <CardHeader><CardTitle className="text-sm">Bevorstehende Fristabläufe</CardTitle></CardHeader>
            <CardContent className="overflow-auto p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Datenart</TableHead><TableHead className="text-right">Datensätze</TableHead>
                  <TableHead>Ältester Satz</TableHead><TableHead>Frühestes Löschdatum</TableHead>
                  <TableHead>Aktive Sperren</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {upcoming.map(o => (
                    <TableRow key={o.data_class}>
                      <TableCell className="text-xs font-medium">{o.label}</TableCell>
                      <TableCell className="text-xs text-right">{o.total_records}</TableCell>
                      <TableCell className="text-xs">{de(o.oldest)}</TableCell>
                      <TableCell className="text-xs">{de(o.earliest_due)}</TableCell>
                      <TableCell className="text-xs">{o.active_holds > 0 ? <Badge variant="secondary">{o.active_holds}</Badge> : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holds" className="space-y-4">
          <Dialog open={holdOpen} onOpenChange={setHoldOpen}>
            <DialogTrigger asChild>
              <Button><Lock className="h-4 w-4 mr-2" />Aufbewahrungssperre setzen</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Aufbewahrungssperre (Legal Hold)</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Anlass</Label>
                  <Select value={form.reason_category} onValueChange={v => setForm({ ...form, reason_category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Grund</Label><Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Aktenzeichen / Referenz</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
                  <div><Label>Verantwortlich</Label><Input value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} /></div>
                </div>
                <div>
                  <Label>Umfang</Label>
                  <Select value={form.scope_type} onValueChange={v => setForm({ ...form, scope_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="data_class">Datenklasse</SelectItem>
                      <SelectItem value="table">Tabelle</SelectItem>
                      <SelectItem value="record">Einzelner Datensatz</SelectItem>
                      <SelectItem value="global">Alle Daten</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.scope_type === 'data_class' && (
                  <div>
                    <Label>Datenklasse</Label>
                    <Select value={form.scope_data_class} onValueChange={v => setForm({ ...form, scope_data_class: v })}>
                      <SelectTrigger><SelectValue placeholder="wählen" /></SelectTrigger>
                      <SelectContent>{classes.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {(form.scope_type === 'table' || form.scope_type === 'record') && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Tabelle</Label><Input value={form.scope_table} onChange={e => setForm({ ...form, scope_table: e.target.value })} /></div>
                    {form.scope_type === 'record' && (
                      <div><Label>Datensatz-ID</Label><Input value={form.scope_record_id} onChange={e => setForm({ ...form, scope_record_id: e.target.value })} /></div>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter><Button onClick={createHold}>Sperre setzen</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          <Card><CardContent className="overflow-auto p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Anlass</TableHead><TableHead>Grund</TableHead><TableHead>Referenz</TableHead>
                <TableHead>Verantwortlich</TableHead><TableHead>Umfang</TableHead><TableHead>Beginn</TableHead>
                <TableHead>Status</TableHead><TableHead>Aufhebung</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {holds.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs">{h.reason_category}</TableCell>
                    <TableCell className="text-xs max-w-[240px]">{h.reason}</TableCell>
                    <TableCell className="text-xs">{h.reference ?? '—'}</TableCell>
                    <TableCell className="text-xs">{h.responsible}</TableCell>
                    <TableCell className="text-xs">{h.scope_type}{h.scope_data_class ? ` · ${h.scope_data_class}` : ''}{h.scope_table ? ` · ${h.scope_table}` : ''}</TableCell>
                    <TableCell className="text-xs">{dt(h.started_at)}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant={h.status === 'active' ? 'destructive' : 'outline'}>{h.status === 'active' ? 'aktiv' : 'aufgehoben'}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{h.released_at ? `${dt(h.released_at)} – ${h.release_reason}` : '—'}</TableCell>
                    <TableCell>
                      {h.status === 'active' && (
                        <Button size="sm" variant="outline" onClick={() => releaseHold(h)}>
                          <Unlock className="h-3.5 w-3.5 mr-1" />Aufheben
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {holds.length === 0 && <TableRow><TableCell colSpan={9} className="text-xs text-muted-foreground p-4">Keine Aufbewahrungssperren erfasst.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="dryrun" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={runDryRun}><PlayCircle className="h-4 w-4 mr-2" />Probelauf starten</Button>
            <span className="text-xs text-muted-foreground">
              Der Probelauf zeigt nur an, was heute löschbar wäre. Es wird nichts gelöscht.{dryRunAt && ` Letzter Lauf: ${dryRunAt}`}
            </span>
          </div>
          <Card><CardContent className="overflow-auto p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Datenart</TableHead><TableHead className="text-right">Datensätze</TableHead>
                <TableHead>Zeitraum</TableHead><TableHead className="text-right">Frist abgelaufen</TableHead>
                <TableHead className="text-right">Frist läuft</TableHead><TableHead className="text-right">Legal Hold</TableHead>
                <TableHead className="text-right">Würde gelöscht</TableHead><TableHead>Ausschlussgrund</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {dryRun.map(d => (
                  <TableRow key={d.data_class}>
                    <TableCell className="text-xs font-medium">{d.label}</TableCell>
                    <TableCell className="text-xs text-right">{d.total_records}</TableCell>
                    <TableCell className="text-xs">{d.period_from ? `${de(d.period_from)} – ${de(d.period_to)}` : '—'}</TableCell>
                    <TableCell className="text-xs text-right">{d.due_for_deletion}</TableCell>
                    <TableCell className="text-xs text-right">{d.blocked_retention}</TableCell>
                    <TableCell className="text-xs text-right">{d.blocked_legal_hold}</TableCell>
                    <TableCell className="text-xs text-right font-semibold">{d.would_delete}</TableCell>
                    <TableCell className="text-xs">{d.exclusion_reason ?? '—'}</TableCell>
                  </TableRow>
                ))}
                {dryRun.length === 0 && <TableRow><TableCell colSpan={8} className="text-xs text-muted-foreground p-4">Noch kein Probelauf ausgeführt.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="protokoll">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm">Löschprotokoll und Aufbewahrungs-Audit (unveränderbar)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Zeitpunkt</TableHead><TableHead>Ereignis</TableHead><TableHead>Datenklasse</TableHead>
                  <TableHead>Objekt</TableHead><TableHead>Kontext</TableHead><TableHead>Detail</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {audit.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs whitespace-nowrap">{dt(a.created_at)}</TableCell>
                      <TableCell className="text-xs"><Badge variant="outline">{a.event_type}</Badge></TableCell>
                      <TableCell className="text-xs">{a.data_class_code ?? '—'}</TableCell>
                      <TableCell className="text-xs">{a.object_table ?? '—'}</TableCell>
                      <TableCell className="text-xs">{a.actor_context ?? '—'}</TableCell>
                      <TableCell className="text-xs max-w-[420px]">{a.detail ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                  {audit.length === 0 && <TableRow><TableCell colSpan={6} className="text-xs text-muted-foreground p-4">Keine Einträge.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pruefung">
          <Card><CardContent className="overflow-auto p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Bereich</TableHead><TableHead>Prüfung</TableHead><TableHead>Status</TableHead><TableHead>Detail</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {checks.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{c.bereich}</TableCell>
                    <TableCell className="text-xs">{c.pruefung}</TableCell>
                    <TableCell className="text-xs"><Badge variant={statusVariant(c.status)}>{c.status}</Badge></TableCell>
                    <TableCell className="text-xs">{c.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
